import type { Action, ActionExample, HandlerCallback } from "@elizaos/core";
import { CUDA_BASE_IMAGES } from "../utils/constants.js";

type Framework = "nodejs" | "python" | "generic";

interface ProjectContext {
  framework: Framework;
  port: number;
  projectName: string;
}

function detectFramework(text: string): ProjectContext {
  const lower = text.toLowerCase();
  let framework: Framework = "generic";
  let port = 3000;
  let projectName = "my-app";

  // Detect framework
  if (
    lower.includes("node") ||
    lower.includes("express") ||
    lower.includes("fastify") ||
    lower.includes("next") ||
    lower.includes("typescript") ||
    lower.includes("npm") ||
    lower.includes("pnpm")
  ) {
    framework = "nodejs";
    port = 3000;
  } else if (
    lower.includes("python") ||
    lower.includes("fastapi") ||
    lower.includes("flask") ||
    lower.includes("django") ||
    lower.includes("uvicorn") ||
    lower.includes("pip")
  ) {
    framework = "python";
    port = 8000;
  }

  // Try to extract port
  const portMatch = lower.match(/port\s*(?::|=|is)?\s*(\d{4,5})/);
  if (portMatch) port = parseInt(portMatch[1], 10);

  // Try to extract project name
  const nameMatch = text.match(/(?:called|named|project|app)\s+["']?([a-zA-Z0-9_-]+)["']?/i);
  if (nameMatch) projectName = nameMatch[1].toLowerCase();

  return { framework, port, projectName };
}

function generateNodeDockerfile(port: number): string {
  return `# syntax=docker/dockerfile:1

# ---- Builder Stage ----
FROM node:23-slim AS builder

RUN apt-get update && apt-get install -y \\
  python3 make g++ git \\
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

# Copy dependency manifests first for layer caching
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# ---- Runtime Stage ----
FROM ${CUDA_BASE_IMAGES.generic}

# Install Node.js runtime
RUN apt-get update && apt-get install -y \\
  curl ca-certificates \\
  && curl -fsSL https://deb.nodesource.com/setup_23.x | bash - \\
  && apt-get install -y nodejs \\
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV SERVER_PORT=${port}

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:${port}/health || exit 1

CMD ["node", "dist/index.js"]
`;
}

function generatePythonDockerfile(port: number): string {
  return `# syntax=docker/dockerfile:1

# ---- Builder Stage ----
FROM python:3.11-slim AS builder

WORKDIR /app

# Copy dependency manifest first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Copy source
COPY . .

# ---- Runtime Stage ----
FROM ${CUDA_BASE_IMAGES.generic}

# Install Python runtime
RUN apt-get update && apt-get install -y \\
  python3 python3-pip curl ca-certificates \\
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed dependencies and source
COPY --from=builder /install /usr/local
COPY --from=builder /app .

ENV PYTHONUNBUFFERED=1
ENV SERVER_PORT=${port}

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:${port}/health || exit 1

CMD ["python3", "main.py"]
`;
}

function generateGenericDockerfile(port: number): string {
  return `# syntax=docker/dockerfile:1

FROM ${CUDA_BASE_IMAGES.generic}

RUN apt-get update && apt-get install -y \\
  curl ca-certificates \\
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy your application files
COPY . .

ENV SERVER_PORT=${port}

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \\
  CMD curl -f http://localhost:${port}/health || exit 1

CMD ["./start.sh"]
`;
}

function generateJobDefinition(ctx: ProjectContext): string {
  const job = {
    version: "0.1",
    type: "container",
    meta: { trigger: "cli" },
    global: { environment: {} },
    ops: [
      {
        type: "container/run",
        id: `run-${ctx.projectName}`,
        args: {
          cmd: [],
          image: `registry.hub.docker.com/yourusername/${ctx.projectName}:latest`,
          gpu: true,
          expose: ctx.port,
          env: {
            NODE_ENV: "production",
            SERVER_PORT: String(ctx.port),
          },
        },
      },
    ],
  };

  return JSON.stringify(job, null, 2);
}

function generateDockerignore(framework: Framework): string {
  const common = [
    "node_modules",
    ".git",
    ".gitignore",
    ".env",
    ".env.*",
    "*.md",
    "LICENSE",
    ".dockerignore",
    "docker-compose*.yml",
    ".vscode",
    ".idea",
  ];

  const nodeSpecific = ["dist", "coverage", ".next", ".nuxt", "*.log", "bun.lock"];
  const pythonSpecific = ["__pycache__", "*.pyc", ".venv", "venv", ".pytest_cache", "*.egg-info"];

  let lines = [...common];
  if (framework === "nodejs") lines = [...lines, ...nodeSpecific];
  if (framework === "python") lines = [...lines, ...pythonSpecific];
  if (framework === "generic") lines = [...lines, ...nodeSpecific, ...pythonSpecific];

  return lines.join("\n") + "\n";
}

export const generateDeployFiles: Action = {
  name: "GENERATE_DEPLOY_FILES",
  description:
    "Generates GPU-ready deployment files for Nosana. Creates an optimized Dockerfile with multi-stage build, CUDA base image, HEALTHCHECK, and proper layer caching, plus a valid Nosana job definition JSON and a .dockerignore file. The user describes their project (language, framework, port) and receives all files ready to use.",
  similes: [
    "CREATE_DEPLOY_FILES",
    "GENERATE_DOCKERFILE",
    "SCAFFOLD_DEPLOYMENT",
    "NOSANA_DEPLOY_SETUP",
    "CREATE_NOSANA_JOB",
    "BOOTSTRAP_DEPLOYMENT",
  ],

  validate: async () => true,

  handler: async (runtime, message, state, options, callback) => {
    const text = message.content.text || "";
    const ctx = detectFramework(text);

    // Generate Dockerfile based on detected framework
    let dockerfile: string;
    switch (ctx.framework) {
      case "nodejs":
        dockerfile = generateNodeDockerfile(ctx.port);
        break;
      case "python":
        dockerfile = generatePythonDockerfile(ctx.port);
        break;
      default:
        dockerfile = generateGenericDockerfile(ctx.port);
    }

    const jobDef = generateJobDefinition(ctx);
    const dockerignore = generateDockerignore(ctx.framework);

    const response = `**Generated Deploy Files for ${ctx.framework} project "${ctx.projectName}" (port ${ctx.port})**

---

### 1. Dockerfile
\`\`\`dockerfile
${dockerfile}\`\`\`

---

### 2. Nosana Job Definition (\`nosana-job.json\`)
\`\`\`json
${jobDef}
\`\`\`

> ⚠️ Replace \`yourusername\` with your Docker Hub username and pin a specific image tag before deploying.

---

### 3. .dockerignore
\`\`\`
${dockerignore}\`\`\`

---

**Next steps:**
1. Save these files to your project root
2. \`docker build -t yourusername/${ctx.projectName}:v1 .\`
3. \`docker push yourusername/${ctx.projectName}:v1\`
4. Update the image tag in \`nosana-job.json\`
5. Deploy: \`nosana job post --file nosana-job.json --market nvidia-4090\``;

    if (callback) {
      await callback({ text: response });
    }

    return {
      success: true,
      data: {
        framework: ctx.framework,
        port: ctx.port,
        projectName: ctx.projectName,
        files: { dockerfile, jobDefinition: jobDef, dockerignore },
      },
    };
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Generate deploy files for a Python FastAPI app called inference-api running on port 8080",
        },
      },
      {
        name: "NosShip",
        content: {
          text: '**Generated Deploy Files for python project "inference-api" (port 8080)**\n\n### 1. Dockerfile\nMulti-stage build with CUDA base, Python runtime, HEALTHCHECK\n\n### 2. Nosana Job Definition\nValid schema with GPU enabled, expose 8080\n\n### 3. .dockerignore\nPython-specific ignores',
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "I need Nosana deployment files for my Node.js Express API",
        },
      },
      {
        name: "NosShip",
        content: {
          text: '**Generated Deploy Files for nodejs project "my-app" (port 3000)**\n\n### 1. Dockerfile\nMulti-stage build with node:23-slim builder, CUDA runtime, HEALTHCHECK\n\n### 2. Nosana Job Definition\nValid schema with GPU enabled, expose 3000\n\n### 3. .dockerignore\nNode.js-specific ignores',
        },
      },
    ],
  ] as ActionExample[][],
};
