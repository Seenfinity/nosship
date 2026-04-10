import { describe, it, expect } from "vitest";
import { validateJobSchema } from "../utils/jobSchemaValidator.js";

describe("validateJobSchema", () => {
  const validJob = {
    version: "0.1",
    ops: [
      {
        type: "container/run",
        id: "my-app",
        args: {
          image: "registry.hub.docker.com/myuser/myapp:v1.0",
          expose: 3000,
          gpu: true,
          env: { NODE_ENV: "production" },
        },
      },
    ],
  };

  it("passes a valid job definition", () => {
    const result = validateJobSchema(validJob);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects non-object input", () => {
    const result = validateJobSchema("not an object");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must be a JSON object");
  });

  it("rejects null input", () => {
    const result = validateJobSchema(null);
    expect(result.valid).toBe(false);
  });

  it("errors on missing version field", () => {
    const job = { ops: validJob.ops };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"version"'))).toBe(true);
  });

  it("errors on wrong version", () => {
    const job = { ...validJob, version: "0.2" };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("0.2"))).toBe(true);
  });

  it("errors on missing ops field", () => {
    const job = { version: "0.1" };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"ops"'))).toBe(true);
  });

  it("errors on empty ops array", () => {
    const job = { version: "0.1", ops: [] };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must not be empty"))).toBe(true);
  });

  it("errors on ops not being an array", () => {
    const job = { version: "0.1", ops: "not-array" };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must be an array"))).toBe(true);
  });

  it("errors on missing op fields (type, id, args)", () => {
    const job = { version: "0.1", ops: [{}] };
    const result = validateJobSchema(job);
    expect(result.errors.some((e) => e.includes('"type"'))).toBe(true);
    expect(result.errors.some((e) => e.includes('"id"'))).toBe(true);
    expect(result.errors.some((e) => e.includes('"args"'))).toBe(true);
  });

  it("errors on bare image name without registry", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "myapp:latest", expose: 3000 },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fully qualified registry path"))).toBe(true);
  });

  it("accepts ghcr.io registry path", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "ghcr.io/myuser/myapp:v1", expose: 3000 },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(true);
  });

  it("accepts nvcr.io registry path", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "nvcr.io/nvidia/pytorch:24.01", expose: 3000 },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(true);
  });

  it("warns on :latest tag", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "registry.hub.docker.com/myuser/myapp:latest", expose: 3000 },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(true); // warning, not error
    expect(result.warnings.some((w) => w.includes(":latest"))).toBe(true);
  });

  it("warns on missing expose", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "registry.hub.docker.com/myuser/myapp:v1" },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(true); // warning, not error
    expect(result.warnings.some((w) => w.includes("expose"))).toBe(true);
  });

  it("errors on invalid expose (not a positive integer)", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "registry.hub.docker.com/myuser/myapp:v1", expose: -1 },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("positive integer"))).toBe(true);
  });

  it("errors on expose as string", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: { image: "registry.hub.docker.com/myuser/myapp:v1", expose: "3000" },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("positive integer"))).toBe(true);
  });

  it("warns when GPU is enabled", () => {
    const result = validateJobSchema(validJob);
    expect(result.warnings.some((w) => w.includes("GPU enabled"))).toBe(true);
  });

  it("errors on non-string env values", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/run",
          id: "test",
          args: {
            image: "registry.hub.docker.com/myuser/myapp:v1",
            expose: 3000,
            env: { PORT: 3000 },
          },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("must be a string"))).toBe(true);
  });

  it("warns on unknown op type", () => {
    const job = {
      version: "0.1",
      ops: [
        {
          type: "container/exec",
          id: "test",
          args: { image: "registry.hub.docker.com/myuser/myapp:v1", expose: 3000 },
        },
      ],
    };
    const result = validateJobSchema(job);
    expect(result.warnings.some((w) => w.includes("unknown operation type"))).toBe(true);
  });
});
