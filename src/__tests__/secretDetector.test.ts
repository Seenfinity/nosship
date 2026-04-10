import { describe, it, expect } from "vitest";
import {
  parseEnvContent,
  detectSecrets,
  detectLocalhostRefs,
  detectMissingVars,
  detectDuplicateKeys,
  detectInsecureSettings,
  reviewEnv,
} from "../utils/secretDetector.js";

describe("parseEnvContent", () => {
  it("parses simple KEY=value pairs", () => {
    const content = `FOO=bar\nBAZ=qux`;
    const result = parseEnvContent(content);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: "FOO", value: "bar", line: 1 });
    expect(result[1]).toEqual({ key: "BAZ", value: "qux", line: 2 });
  });

  it("skips comments and empty lines", () => {
    const content = `# comment\nFOO=bar\n\n# another\nBAZ=qux`;
    const result = parseEnvContent(content);
    expect(result).toHaveLength(2);
  });

  it("strips surrounding quotes", () => {
    const content = `FOO="hello world"\nBAR='single quotes'`;
    const result = parseEnvContent(content);
    expect(result[0].value).toBe("hello world");
    expect(result[1].value).toBe("single quotes");
  });

  it("handles values with = signs", () => {
    const content = `DATABASE_URL=postgres://user:pass@host:5432/db?ssl=true`;
    const result = parseEnvContent(content);
    expect(result[0].value).toBe("postgres://user:pass@host:5432/db?ssl=true");
  });

  it("handles empty values", () => {
    const content = `EMPTY_VAR=`;
    const result = parseEnvContent(content);
    expect(result[0].value).toBe("");
  });
});

describe("detectSecrets", () => {
  it("detects AWS access key pattern", () => {
    const entries = [{ key: "AWS_KEY", value: "AKIAIOSFODNN7EXAMPLE", line: 1 }];
    const result = detectSecrets(entries);
    expect(result).toHaveLength(1);
    expect(result[0].patternName).toBe("AWS Access Key");
    expect(result[0].severity).toBe("critical");
  });

  it("detects GitHub token pattern", () => {
    const entries = [{ key: "GH_TOKEN", value: "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij", line: 1 }];
    const result = detectSecrets(entries);
    expect(result).toHaveLength(1);
    expect(result[0].patternName).toBe("GitHub Token (classic)");
  });

  it("detects OpenAI API key pattern", () => {
    const entries = [{ key: "OPENAI_API_KEY", value: "sk-1234567890abcdefghijklmnopqrstuv", line: 1 }];
    const result = detectSecrets(entries);
    expect(result).toHaveLength(1);
    expect(result[0].patternName).toBe("OpenAI API Key");
  });

  it("ignores placeholder values", () => {
    const entries = [
      { key: "OPENAI_API_KEY", value: "nosana", line: 1 },
      { key: "API_KEY", value: "your-key-here", line: 2 },
      { key: "TOKEN", value: "changeme", line: 3 },
    ];
    const result = detectSecrets(entries);
    expect(result).toHaveLength(0);
  });

  it("flags suspicious key names with long non-placeholder values", () => {
    const entries = [{ key: "MY_SECRET_TOKEN", value: "a1b2c3d4e5f6g7h8i9j0", line: 1 }];
    const result = detectSecrets(entries);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((r) => r.severity === "warning" || r.severity === "critical")).toBe(true);
  });

  it("redacts detected values", () => {
    const entries = [{ key: "AWS_KEY", value: "AKIAIOSFODNN7EXAMPLE", line: 1 }];
    const result = detectSecrets(entries);
    expect(result[0].redactedValue).not.toBe("AKIAIOSFODNN7EXAMPLE");
    expect(result[0].redactedValue).toContain("...");
  });
});

describe("detectLocalhostRefs", () => {
  it("detects localhost in URL", () => {
    const entries = [{ key: "API_URL", value: "http://localhost:11434/v1", line: 1 }];
    const result = detectLocalhostRefs(entries);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("API_URL");
  });

  it("detects 127.0.0.1", () => {
    const entries = [{ key: "DB_HOST", value: "127.0.0.1:5432", line: 1 }];
    const result = detectLocalhostRefs(entries);
    expect(result).toHaveLength(1);
  });

  it("detects 0.0.0.0", () => {
    const entries = [{ key: "BIND", value: "0.0.0.0:8080", line: 1 }];
    const result = detectLocalhostRefs(entries);
    expect(result).toHaveLength(1);
  });

  it("detects host.docker.internal", () => {
    const entries = [{ key: "SERVICE", value: "http://host.docker.internal:3000", line: 1 }];
    const result = detectLocalhostRefs(entries);
    expect(result).toHaveLength(1);
  });

  it("does not flag remote URLs", () => {
    const entries = [{ key: "API_URL", value: "https://api.nosana.com/v1", line: 1 }];
    const result = detectLocalhostRefs(entries);
    expect(result).toHaveLength(0);
  });
});

describe("detectMissingVars", () => {
  it("reports all missing when env is empty", () => {
    const result = detectMissingVars([]);
    expect(result).toHaveLength(4); // OPENAI_API_KEY, OPENAI_API_URL, MODEL_NAME, SERVER_PORT
  });

  it("reports none missing when all present", () => {
    const entries = [
      { key: "OPENAI_API_KEY", value: "nosana", line: 1 },
      { key: "OPENAI_API_URL", value: "https://endpoint/v1", line: 2 },
      { key: "MODEL_NAME", value: "qwen3.5-27b", line: 3 },
      { key: "SERVER_PORT", value: "3000", line: 4 },
    ];
    const result = detectMissingVars(entries);
    expect(result).toHaveLength(0);
  });

  it("reports only missing vars", () => {
    const entries = [
      { key: "OPENAI_API_KEY", value: "nosana", line: 1 },
      { key: "SERVER_PORT", value: "3000", line: 2 },
    ];
    const result = detectMissingVars(entries);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.variable)).toContain("OPENAI_API_URL");
    expect(result.map((r) => r.variable)).toContain("MODEL_NAME");
  });
});

describe("detectDuplicateKeys", () => {
  it("detects duplicate keys", () => {
    const entries = [
      { key: "FOO", value: "bar", line: 1 },
      { key: "BAZ", value: "qux", line: 2 },
      { key: "FOO", value: "override", line: 3 },
    ];
    const result = detectDuplicateKeys(entries);
    expect(result).toEqual(["FOO"]);
  });

  it("returns empty for unique keys", () => {
    const entries = [
      { key: "A", value: "1", line: 1 },
      { key: "B", value: "2", line: 2 },
    ];
    const result = detectDuplicateKeys(entries);
    expect(result).toHaveLength(0);
  });
});

describe("detectInsecureSettings", () => {
  it("flags DEBUG=true", () => {
    const entries = [{ key: "DEBUG", value: "true", line: 1 }];
    const result = detectInsecureSettings(entries);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("Debug");
  });

  it("flags NODE_ENV=development", () => {
    const entries = [{ key: "NODE_ENV", value: "development", line: 1 }];
    const result = detectInsecureSettings(entries);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("production");
  });

  it("flags LOG_LEVEL=debug", () => {
    const entries = [{ key: "LOG_LEVEL", value: "debug", line: 1 }];
    const result = detectInsecureSettings(entries);
    expect(result).toHaveLength(1);
  });

  it("does not flag production-safe settings", () => {
    const entries = [
      { key: "NODE_ENV", value: "production", line: 1 },
      { key: "LOG_LEVEL", value: "warn", line: 2 },
    ];
    const result = detectInsecureSettings(entries);
    expect(result).toHaveLength(0);
  });
});

describe("reviewEnv (integration)", () => {
  it("catches multiple issue types in one pass", () => {
    const content = `OPENAI_API_KEY=sk-1234567890abcdefghijklmnopqrstuv
OPENAI_API_URL=http://localhost:11434/v1
DEBUG=true
OPENAI_API_KEY=duplicate-key`;

    const result = reviewEnv(content);
    expect(result.secrets.length).toBeGreaterThan(0);
    expect(result.localhostRefs.length).toBeGreaterThan(0);
    expect(result.insecureSettings.length).toBeGreaterThan(0);
    expect(result.duplicateKeys).toContain("OPENAI_API_KEY");
    expect(result.missingVars.length).toBeGreaterThan(0); // missing MODEL_NAME, SERVER_PORT
  });

  it("returns clean result for a valid env", () => {
    const content = `OPENAI_API_KEY=nosana
OPENAI_API_URL=https://qwen.nosana.com/v1
MODEL_NAME=qwen3.5-27b-awq-4bit
SERVER_PORT=3000
NODE_ENV=production`;

    const result = reviewEnv(content);
    expect(result.secrets).toHaveLength(0);
    expect(result.localhostRefs).toHaveLength(0);
    expect(result.missingVars).toHaveLength(0);
    expect(result.duplicateKeys).toHaveLength(0);
    expect(result.insecureSettings).toHaveLength(0);
  });
});
