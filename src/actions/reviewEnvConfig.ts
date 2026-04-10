import type { Action, ActionExample, HandlerCallback } from "@elizaos/core";
import {
  parseEnvContent,
  detectSecrets,
  detectLocalhostRefs,
  detectMissingVars,
  detectDuplicateKeys,
  detectInsecureSettings,
  type EnvReviewResult,
} from "../utils/secretDetector.js";

function formatEnvReport(result: EnvReviewResult): string {
  const totalIssues =
    result.secrets.length +
    result.localhostRefs.length +
    result.missingVars.length +
    result.duplicateKeys.length +
    result.insecureSettings.length;

  if (totalIssues === 0) {
    return "**Env Config Review: All clear.** ✅\n\nNo secrets, no localhost refs, all required vars present. You're good to deploy.";
  }

  let report = `**Env Config Review: ${totalIssues} issue(s) found**\n\n`;

  // Secrets
  if (result.secrets.length > 0) {
    report += "### Hardcoded Secrets\n";
    for (const s of result.secrets) {
      const icon = s.severity === "critical" ? "🔴" : "🟡";
      report += `${icon} Line ${s.line}: \`${s.key}\` — ${s.patternName} detected (value: \`${s.redactedValue}\`)\n`;
    }
    report += "→ **Never commit real credentials.** Use Nosana job env vars or a secret manager.\n\n";
  }

  // Localhost refs
  if (result.localhostRefs.length > 0) {
    report += "### Localhost References\n";
    for (const l of result.localhostRefs) {
      report += `🟡 Line ${l.line}: \`${l.key}=${l.value}\` — localhost won't resolve inside a Nosana container.\n`;
    }
    report += "→ Replace with the actual Nosana endpoint URL or the service's public address.\n\n";
  }

  // Missing vars
  if (result.missingVars.length > 0) {
    report += "### Missing Required Variables\n";
    for (const m of result.missingVars) {
      report += `🔵 \`${m.variable}\` — not defined. Suggested value: \`${m.suggestion}\`\n`;
    }
    report += "\n";
  }

  // Duplicate keys
  if (result.duplicateKeys.length > 0) {
    report += "### Duplicate Keys\n";
    for (const k of result.duplicateKeys) {
      report += `🟡 \`${k}\` appears more than once — only the last value will be used.\n`;
    }
    report += "\n";
  }

  // Insecure settings
  if (result.insecureSettings.length > 0) {
    report += "### Insecure Production Settings\n";
    for (const s of result.insecureSettings) {
      report += `🟡 Line ${s.line}: \`${s.key}=${s.value}\` — ${s.reason}\n`;
    }
    report += "\n";
  }

  return report;
}

export const reviewEnvConfig: Action = {
  name: "REVIEW_ENV_CONFIG",
  description:
    "Reviews .env file content or environment variable configuration for security issues. Detects hardcoded secrets (API keys, tokens, passwords), localhost URLs that won't work on Nosana, missing required GPU service variables, duplicate keys, and insecure production settings. The user pastes their .env content and receives a security audit report.",
  similes: [
    "CHECK_ENV",
    "ENV_AUDIT",
    "REVIEW_ENVIRONMENT",
    "ENV_SECURITY_CHECK",
    "CHECK_ENVIRONMENT_VARIABLES",
  ],

  validate: async () => true,

  handler: async (runtime, message, state, options, callback) => {
    const text = message.content.text || "";

    // Extract env content from fenced code blocks or raw text
    let envContent = "";
    const fencedMatch = text.match(/```(?:env|bash|sh|dotenv|properties)?\s*\n([\s\S]*?)```/);
    if (fencedMatch) {
      envContent = fencedMatch[1].trim();
    } else if (text.includes("=")) {
      // Try to extract lines that look like env vars
      envContent = text
        .split("\n")
        .filter((line) => {
          const trimmed = line.trim();
          return trimmed.includes("=") && !trimmed.startsWith("//") && !trimmed.startsWith("*");
        })
        .join("\n");
    }

    if (!envContent || !envContent.includes("=")) {
      if (callback) {
        await callback({
          text: "I need .env content to review. Paste your environment variables (KEY=value format) and I'll audit them for security issues, localhost refs, and missing vars.",
        });
      }
      return { success: false, error: "No env content found in message" };
    }

    const result: EnvReviewResult = {
      secrets: detectSecrets(parseEnvContent(envContent)),
      localhostRefs: detectLocalhostRefs(parseEnvContent(envContent)),
      missingVars: detectMissingVars(parseEnvContent(envContent)),
      duplicateKeys: detectDuplicateKeys(parseEnvContent(envContent)),
      insecureSettings: detectInsecureSettings(parseEnvContent(envContent)),
    };

    const report = formatEnvReport(result);

    if (callback) {
      await callback({ text: report });
    }

    return {
      success: true,
      data: {
        secretCount: result.secrets.length,
        localhostCount: result.localhostRefs.length,
        missingCount: result.missingVars.length,
        duplicateCount: result.duplicateKeys.length,
        insecureCount: result.insecureSettings.length,
      },
    };
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Review my env config:\n```\nOPENAI_API_KEY=sk-1234567890abcdefghijklmnopqrstuv\nOPENAI_API_URL=http://localhost:11434/v1\nMODEL_NAME=qwen3.5-27b\nDEBUG=true\n```",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "**Env Config Review: 4 issue(s) found**\n\n### Hardcoded Secrets\n🔴 Line 1: `OPENAI_API_KEY` — OpenAI API Key detected\n\n### Localhost References\n🟡 Line 2: `OPENAI_API_URL=http://localhost:11434/v1` — localhost won't resolve inside a Nosana container.\n\n### Missing Required Variables\n🔵 `SERVER_PORT` — not defined.\n\n### Insecure Production Settings\n🟡 Line 4: `DEBUG=true` — Debug mode should be disabled in production",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Check this env:\n```\nOPENAI_API_KEY=nosana\nOPENAI_API_URL=https://qwen.nosana.com/v1\nMODEL_NAME=qwen3.5-27b-awq-4bit\nSERVER_PORT=3000\nNODE_ENV=production\n```",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "**Env Config Review: All clear.** ✅\n\nNo secrets, no localhost refs, all required vars present. You're good to deploy.",
        },
      },
    ],
  ] as ActionExample[][],
};
