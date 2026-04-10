import { SECRET_PATTERNS, LOCALHOST_PATTERNS, PLACEHOLDER_VALUES, GPU_SERVICE_REQUIRED_VARS } from "./constants.js";

export interface SecretIssue {
  line: number;
  key: string;
  patternName: string;
  redactedValue: string;
  severity: "critical" | "warning";
}

export interface LocalhostIssue {
  line: number;
  key: string;
  value: string;
  severity: "warning";
}

export interface MissingVarIssue {
  variable: string;
  suggestion: string;
}

export interface EnvReviewResult {
  secrets: SecretIssue[];
  localhostRefs: LocalhostIssue[];
  missingVars: MissingVarIssue[];
  duplicateKeys: string[];
  insecureSettings: { line: number; key: string; value: string; reason: string }[];
}

// Redact a value — show first 4 and last 4 chars if long enough
function redact(value: string): string {
  if (value.length <= 10) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return PLACEHOLDER_VALUES.some((p) => lower === p.toLowerCase() || lower.includes(p.toLowerCase()));
}

// Parse .env content into key-value pairs with line numbers
export function parseEnvContent(content: string): { key: string; value: string; line: number }[] {
  const entries: { key: string; value: string; line: number }[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    // Skip empty lines and comments
    if (!raw || raw.startsWith("#")) continue;

    const eqIndex = raw.indexOf("=");
    if (eqIndex === -1) continue;

    const key = raw.slice(0, eqIndex).trim();
    let value = raw.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    entries.push({ key, value, line: i + 1 });
  }

  return entries;
}

// Detect hardcoded secrets in values
export function detectSecrets(entries: { key: string; value: string; line: number }[]): SecretIssue[] {
  const issues: SecretIssue[] = [];

  for (const entry of entries) {
    if (isPlaceholder(entry.value)) continue;

    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(entry.value)) {
        issues.push({
          line: entry.line,
          key: entry.key,
          patternName: name,
          redactedValue: redact(entry.value),
          severity: "critical",
        });
        break; // One match per entry is enough
      }
    }

    // Also flag keys that look like secrets with non-placeholder values
    const secretKeyPattern = /(?:password|secret|private.?key|token|api.?key|auth)/i;
    if (
      secretKeyPattern.test(entry.key) &&
      entry.value.length > 8 &&
      !isPlaceholder(entry.value) &&
      !issues.some((i) => i.line === entry.line)
    ) {
      issues.push({
        line: entry.line,
        key: entry.key,
        patternName: "Suspicious key name with non-placeholder value",
        redactedValue: redact(entry.value),
        severity: "warning",
      });
    }
  }

  return issues;
}

// Detect localhost references that won't work in Nosana containers
export function detectLocalhostRefs(entries: { key: string; value: string; line: number }[]): LocalhostIssue[] {
  const issues: LocalhostIssue[] = [];

  for (const entry of entries) {
    for (const pattern of LOCALHOST_PATTERNS) {
      if (pattern.test(entry.value)) {
        issues.push({
          line: entry.line,
          key: entry.key,
          value: entry.value,
          severity: "warning",
        });
        break;
      }
    }
  }

  return issues;
}

// Detect missing required GPU service variables
export function detectMissingVars(entries: { key: string; value: string; line: number }[]): MissingVarIssue[] {
  const presentKeys = new Set(entries.map((e) => e.key));
  const suggestions: Record<string, string> = {
    OPENAI_API_KEY: "nosana",
    OPENAI_API_URL: "https://<your-nosana-endpoint>/v1",
    MODEL_NAME: "qwen3.5-27b-awq-4bit",
    SERVER_PORT: "3000",
  };

  return GPU_SERVICE_REQUIRED_VARS.filter((v) => !presentKeys.has(v)).map((variable) => ({
    variable,
    suggestion: suggestions[variable] || "",
  }));
}

// Detect duplicate keys
export function detectDuplicateKeys(entries: { key: string; value: string; line: number }[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.key)) {
      duplicates.add(entry.key);
    }
    seen.add(entry.key);
  }

  return Array.from(duplicates);
}

// Detect insecure production settings
export function detectInsecureSettings(
  entries: { key: string; value: string; line: number }[]
): { line: number; key: string; value: string; reason: string }[] {
  const issues: { line: number; key: string; value: string; reason: string }[] = [];

  const checks: { key: string; value: string; reason: string }[] = [
    { key: "DEBUG", value: "true", reason: "Debug mode should be disabled in production" },
    { key: "DEBUG", value: "1", reason: "Debug mode should be disabled in production" },
    { key: "NODE_ENV", value: "development", reason: "Should be 'production' for Nosana deployment" },
    { key: "LOG_LEVEL", value: "verbose", reason: "Verbose logging can leak sensitive info in production" },
    { key: "LOG_LEVEL", value: "debug", reason: "Debug logging can leak sensitive info in production" },
  ];

  for (const entry of entries) {
    for (const check of checks) {
      if (entry.key.toUpperCase() === check.key && entry.value.toLowerCase() === check.value) {
        issues.push({
          line: entry.line,
          key: entry.key,
          value: entry.value,
          reason: check.reason,
        });
      }
    }
  }

  return issues;
}

// Full env review — runs all detectors
export function reviewEnv(content: string): EnvReviewResult {
  const entries = parseEnvContent(content);

  return {
    secrets: detectSecrets(entries),
    localhostRefs: detectLocalhostRefs(entries),
    missingVars: detectMissingVars(entries),
    duplicateKeys: detectDuplicateKeys(entries),
    insecureSettings: detectInsecureSettings(entries),
  };
}
