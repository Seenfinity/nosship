import type { Action, ActionExample, HandlerCallback } from "@elizaos/core";
import { validateJobSchema } from "../utils/jobSchemaValidator.js";

function extractJson(text: string): string | null {
  // Try fenced code block first
  const fencedMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fencedMatch) return fencedMatch[1].trim();

  // Try to find JSON object boundaries
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function formatValidationReport(
  result: { valid: boolean; errors: string[]; warnings: string[] },
  parseError?: string
): string {
  if (parseError) {
    return `**Job Validation: FAILED — Invalid JSON**\n\n🔴 Parse error: ${parseError}\n\nMake sure the job definition is valid JSON. Common issues: trailing commas, unquoted keys, single quotes instead of double quotes.`;
  }

  if (result.valid && result.warnings.length === 0) {
    return "**Job Validation: PASSED** ✅\n\nYour Nosana job definition is schema-valid with no warnings. Ready to deploy.";
  }

  let report = result.valid
    ? `**Job Validation: PASSED with ${result.warnings.length} warning(s)**\n\n`
    : `**Job Validation: FAILED — ${result.errors.length} error(s), ${result.warnings.length} warning(s)**\n\n`;

  for (const err of result.errors) {
    report += `🔴 **[ERROR]** ${err}\n`;
  }
  for (const warn of result.warnings) {
    report += `🟡 **[WARNING]** ${warn}\n`;
  }

  if (!result.valid) {
    report += "\nFix the errors above and I'll validate again.";
  }

  return report;
}

export const validateNosanaJob: Action = {
  name: "VALIDATE_NOSANA_JOB",
  description:
    "Validates a Nosana job definition JSON against the required schema. Checks for valid version, operation structure, fully qualified Docker image registry paths, port exposure, GPU market information, and env variable types. The user provides a Nosana job definition JSON and receives a validation report.",
  similes: [
    "CHECK_JOB_DEFINITION",
    "VALIDATE_JOB",
    "NOSANA_JOB_LINT",
    "JOB_SCHEMA_CHECK",
    "VERIFY_NOSANA_JOB",
  ],

  validate: async () => true,

  handler: async (runtime, message, state, options, callback) => {
    const text = message.content.text || "";
    const jsonStr = extractJson(text);

    if (!jsonStr) {
      if (callback) {
        await callback({
          text: "I need a Nosana job definition JSON to validate. Paste the JSON or wrap it in a code block and I'll check it against the schema.",
        });
      }
      return { success: false, error: "No JSON content found in message" };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      const parseError = e instanceof Error ? e.message : "Unknown parse error";
      const report = formatValidationReport({ valid: false, errors: [], warnings: [] }, parseError);
      if (callback) {
        await callback({ text: report });
      }
      return { success: false, error: parseError };
    }

    const result = validateJobSchema(parsed);
    const report = formatValidationReport(result);

    if (callback) {
      await callback({ text: report });
    }

    return {
      success: true,
      data: { valid: result.valid, errorCount: result.errors.length, warningCount: result.warnings.length },
    };
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: 'Validate this Nosana job definition:\n```json\n{\n  "version": "0.1",\n  "ops": [\n    {\n      "type": "container/run",\n      "id": "my-app",\n      "args": {\n        "image": "registry.hub.docker.com/myuser/myapp:v1.0",\n        "gpu": true,\n        "expose": 3000,\n        "env": { "NODE_ENV": "production" }\n      }\n    }\n  ]\n}\n```',
        },
      },
      {
        name: "NosShip",
        content: {
          text: "**Job Validation: PASSED with 1 warning(s)**\n\n🟡 **[WARNING]** ops[0].args: GPU enabled. Available Nosana markets: nvidia-3090, nvidia-4090. Select your market when deploying via the Nosana CLI.",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: 'Check if this job def is valid:\n```json\n{\n  "version": "0.2",\n  "ops": [\n    {\n      "type": "container/run",\n      "id": "broken-app",\n      "args": {\n        "image": "myapp:latest"\n      }\n    }\n  ]\n}\n```',
        },
      },
      {
        name: "NosShip",
        content: {
          text: '**Job Validation: FAILED — 2 error(s), 1 warning(s)**\n\n🔴 **[ERROR]** Invalid version "0.2". Must be "0.1"\n🔴 **[ERROR]** ops[0].args.image: "myapp:latest" is not a fully qualified registry path.\n🟡 **[WARNING]** ops[0].args: no "expose" port defined.',
        },
      },
    ],
  ] as ActionExample[][],
};
