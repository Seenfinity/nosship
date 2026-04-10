import type { Action, ActionExample, HandlerCallback } from "@elizaos/core";
import { parseDockerfile } from "../utils/dockerfileParser.js";
import { CUDA_BASE_IMAGES } from "../utils/constants.js";

interface DockerfileIssue {
  severity: "error" | "warning" | "info";
  message: string;
  line?: number;
  fix?: string;
}

function analyzeIssues(content: string): DockerfileIssue[] {
  const analysis = parseDockerfile(content);
  const issues: DockerfileIssue[] = [];

  if (!analysis.hasMultiStage) {
    issues.push({
      severity: "error",
      message: "No multi-stage build detected. Your final image carries build tools and intermediate artifacts, bloating its size.",
      fix: "Add a builder stage: `FROM node:23-slim AS builder` for build steps, then `FROM nvidia/cuda:... AS runtime` for the final image, copying only what's needed.",
    });
  }

  if (!analysis.hasCudaBase) {
    issues.push({
      severity: "warning",
      message: "No CUDA base image found. GPU workloads on Nosana require a CUDA-enabled base image.",
      fix: `Use a CUDA base for your runtime stage, e.g. \`FROM ${CUDA_BASE_IMAGES.generic}\``,
    });
  }

  if (analysis.copyBeforeInstall) {
    issues.push({
      severity: "error",
      message: "COPY of full source tree happens before dependency installation. This busts the Docker layer cache — every code change triggers a full reinstall.",
      fix: "Copy only the dependency manifest first (e.g. `COPY package.json pnpm-lock.yaml ./`), run install, THEN `COPY . .`",
    });
  }

  if (!analysis.hasHealthcheck) {
    issues.push({
      severity: "warning",
      message: "No HEALTHCHECK instruction. Nosana uses health probes to verify container readiness.",
      fix: "Add: `HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD curl -f http://localhost:$PORT/health || exit 1`",
    });
  }

  if (analysis.usesLatestTag) {
    const offending = analysis.stages.filter(
      (s) => s.baseImage.endsWith(":latest") || !s.baseImage.includes(":")
    );
    for (const stage of offending) {
      issues.push({
        severity: "warning",
        message: `Stage at line ${stage.lineNumber} uses image "${stage.baseImage}" without a pinned version. Builds become non-deterministic.`,
        line: stage.lineNumber,
        fix: "Pin a specific tag, e.g. `node:23-slim` instead of `node:latest`.",
      });
    }
  }

  if (analysis.estimatedLayers > 15) {
    issues.push({
      severity: "info",
      message: `High layer count (~${analysis.estimatedLayers}). Consider combining consecutive RUN instructions with \`&&\` to reduce layers.`,
    });
  }

  if (!analysis.hasExposeInstruction) {
    issues.push({
      severity: "info",
      message: "No EXPOSE instruction. While not strictly required, it documents the port your service listens on.",
      fix: "Add `EXPOSE <port>` to make the listening port explicit.",
    });
  }

  return issues;
}

function formatReport(issues: DockerfileIssue[]): string {
  if (issues.length === 0) {
    return "**Dockerfile Analysis: All clear.** No anti-patterns detected. Your Dockerfile looks GPU-ready.";
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const infos = issues.filter((i) => i.severity === "info");

  let report = `**Dockerfile Analysis: ${issues.length} issue(s) found**\n`;
  report += `${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info(s)\n\n`;

  for (const issue of issues) {
    const icon = issue.severity === "error" ? "🔴" : issue.severity === "warning" ? "🟡" : "🔵";
    report += `${icon} **[${issue.severity.toUpperCase()}]** ${issue.message}\n`;
    if (issue.fix) {
      report += `   → Fix: ${issue.fix}\n`;
    }
    report += "\n";
  }

  return report;
}

export const analyzeDockerfile: Action = {
  name: "ANALYZE_DOCKERFILE",
  description:
    "Analyzes a Dockerfile for GPU deployment anti-patterns. Detects missing multi-stage builds, missing CUDA base images, broken Docker layer caching, missing HEALTHCHECK, unpinned image tags, and excessive layers. The user provides Dockerfile content and receives a detailed report with issues and fixes.",
  similes: [
    "CHECK_DOCKERFILE",
    "REVIEW_DOCKERFILE",
    "DOCKERFILE_AUDIT",
    "LINT_DOCKERFILE",
    "OPTIMIZE_DOCKERFILE",
  ],

  validate: async () => true,

  handler: async (runtime, message, state, options, callback) => {
    const text = message.content.text || "";

    // Extract Dockerfile content — look for fenced code blocks or raw FROM-based content
    let dockerfileContent = "";

    const fencedMatch = text.match(/```(?:dockerfile|docker|Dockerfile)?\s*\n([\s\S]*?)```/);
    if (fencedMatch) {
      dockerfileContent = fencedMatch[1].trim();
    } else if (text.includes("FROM ")) {
      // Try to extract starting from the first FROM
      const fromIndex = text.indexOf("FROM ");
      dockerfileContent = text.slice(fromIndex).trim();
    } else {
      dockerfileContent = text.trim();
    }

    if (!dockerfileContent || !dockerfileContent.includes("FROM")) {
      if (callback) {
        await callback({
          text: "I need Dockerfile content to analyze. Paste your Dockerfile or wrap it in a code block and I'll tear it apart for GPU-readiness issues.",
        });
      }
      return { success: false, error: "No Dockerfile content found in message" };
    }

    const issues = analyzeIssues(dockerfileContent);
    const report = formatReport(issues);

    if (callback) {
      await callback({ text: report });
    }

    return {
      success: true,
      data: { issueCount: issues.length, issues },
    };
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Can you check this Dockerfile for problems?\n```dockerfile\nFROM node:latest\nCOPY . /app\nWORKDIR /app\nRUN npm install\nRUN npm run build\nCMD [\"node\", \"dist/index.js\"]\n```",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "**Dockerfile Analysis: 4 issue(s) found**\n\n🔴 **[ERROR]** No multi-stage build detected.\n🔴 **[ERROR]** COPY of full source tree happens before dependency installation.\n🟡 **[WARNING]** No CUDA base image found.\n🟡 **[WARNING]** No HEALTHCHECK instruction.",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "Review my Dockerfile:\n```dockerfile\nFROM nvidia/cuda:12.1.0-base-ubuntu22.04 AS builder\nRUN apt-get update && apt-get install -y python3 python3-pip\nCOPY requirements.txt .\nRUN pip3 install -r requirements.txt\nCOPY . .\nRUN python3 -m compileall .\n\nFROM nvidia/cuda:12.1.0-base-ubuntu22.04\nCOPY --from=builder /app /app\nEXPOSE 8000\nHEALTHCHECK CMD curl -f http://localhost:8000/health || exit 1\nCMD [\"python3\", \"main.py\"]\n```",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "**Dockerfile Analysis: All clear.** No anti-patterns detected. Your Dockerfile looks GPU-ready. Multi-stage build, CUDA base, proper caching, and HEALTHCHECK all present.",
        },
      },
    ],
  ] as ActionExample[][],
};
