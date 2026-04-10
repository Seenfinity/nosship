import { NOSANA_JOB_REQUIRED_FIELDS, VALID_GPU_MARKETS, KNOWN_REGISTRIES } from "./constants.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasFullRegistryPath(image: string): boolean {
  // Must contain a hostname-like prefix (has a dot or is a known registry)
  if (KNOWN_REGISTRIES.some((r) => image.startsWith(r))) return true;

  // Split off tag/digest first, then check the first path segment for a hostname
  const imageWithoutTag = image.split(":")[0].split("@")[0];
  const firstSegment = imageWithoutTag.split("/")[0];

  // A registry hostname contains a dot (e.g. ghcr.io, nvcr.io, my.registry.com)
  // or a port (e.g. localhost:5000 — but that would have been caught by the colon after stripping tag)
  if (firstSegment.includes(".")) return true;

  // Must have at least 2 path segments (org/image) to not be a bare name
  if (!imageWithoutTag.includes("/")) return false;

  return false;
}

export function validateJobSchema(job: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(job)) {
    return { valid: false, errors: ["Job definition must be a JSON object"], warnings };
  }

  // Check top-level required fields
  for (const field of NOSANA_JOB_REQUIRED_FIELDS.topLevel) {
    if (!(field in job)) {
      errors.push(`Missing required top-level field: "${field}"`);
    }
  }

  // Validate version
  if ("version" in job && job.version !== NOSANA_JOB_REQUIRED_FIELDS.validVersion) {
    errors.push(
      `Invalid version "${job.version}". Must be "${NOSANA_JOB_REQUIRED_FIELDS.validVersion}"`
    );
  }

  // Validate ops array
  if (!("ops" in job)) {
    return { valid: errors.length === 0, errors, warnings };
  }

  if (!Array.isArray(job.ops)) {
    errors.push('"ops" must be an array');
    return { valid: false, errors, warnings };
  }

  if (job.ops.length === 0) {
    errors.push('"ops" array must not be empty');
    return { valid: false, errors, warnings };
  }

  // Validate each operation
  for (let i = 0; i < job.ops.length; i++) {
    const op = job.ops[i];
    const prefix = `ops[${i}]`;

    if (!isRecord(op)) {
      errors.push(`${prefix}: each operation must be an object`);
      continue;
    }

    // Required op fields
    for (const field of NOSANA_JOB_REQUIRED_FIELDS.opFields) {
      if (!(field in op)) {
        errors.push(`${prefix}: missing required field "${field}"`);
      }
    }

    // Validate op type
    if (
      "type" in op &&
      typeof op.type === "string" &&
      !NOSANA_JOB_REQUIRED_FIELDS.validOpTypes.includes(
        op.type as (typeof NOSANA_JOB_REQUIRED_FIELDS.validOpTypes)[number]
      )
    ) {
      warnings.push(
        `${prefix}: unknown operation type "${op.type}". Expected one of: ${NOSANA_JOB_REQUIRED_FIELDS.validOpTypes.join(", ")}`
      );
    }

    // Validate args
    if (!("args" in op) || !isRecord(op.args)) continue;
    const args = op.args;

    // Validate image
    if (!("image" in args) || typeof args.image !== "string" || args.image.trim() === "") {
      errors.push(`${prefix}.args: missing or empty "image" field`);
    } else {
      const image = args.image as string;
      if (!hasFullRegistryPath(image)) {
        errors.push(
          `${prefix}.args.image: "${image}" is not a fully qualified registry path. ` +
            `Use the full path, e.g. "registry.hub.docker.com/yourusername/image:tag"`
        );
      }
      if (image.endsWith(":latest")) {
        warnings.push(
          `${prefix}.args.image: using ":latest" tag is non-deterministic. Pin a specific version.`
        );
      }
    }

    // Validate expose
    if (!("expose" in args)) {
      warnings.push(`${prefix}.args: no "expose" port defined. Your service won't be reachable.`);
    } else if (typeof args.expose !== "number" || args.expose <= 0 || !Number.isInteger(args.expose)) {
      errors.push(`${prefix}.args.expose: must be a positive integer, got "${args.expose}"`);
    }

    // GPU info
    if ("gpu" in args && args.gpu === true) {
      warnings.push(
        `${prefix}.args: GPU enabled. Available Nosana markets: ${VALID_GPU_MARKETS.join(", ")}. ` +
          `Select your market when deploying via the Nosana CLI.`
      );
    }

    // Validate env if present
    if ("env" in args && args.env !== undefined) {
      if (!isRecord(args.env)) {
        errors.push(`${prefix}.args.env: must be an object with string values`);
      } else {
        for (const [key, val] of Object.entries(args.env)) {
          if (typeof val !== "string") {
            errors.push(`${prefix}.args.env.${key}: value must be a string, got ${typeof val}`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
