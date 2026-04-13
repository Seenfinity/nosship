import type { Provider } from "@elizaos/core";
import { VALID_GPU_MARKETS, CUDA_BASE_IMAGES, GPU_SERVICE_REQUIRED_VARS } from "../utils/constants.js";

const NOSANA_CONTEXT = `## NosShip — Personal Agent Factory & Deployment Platform

### Agent Factory Workflow
1. **DESIGN_AGENT** → User describes what agent they want in natural language → generates a complete ElizaOS v2 character file (name, bio, system prompt, plugins, topics, message examples)
2. **SELECT_PLUGINS** → Analyzes requirements and recommends the optimal ElizaOS plugin stack with env vars and install commands
3. **GENERATE_DEPLOY_FILES** → Creates Dockerfile + Nosana job definition + .dockerignore for deployment
4. **ANALYZE_DOCKERFILE** → Reviews existing Dockerfiles for GPU anti-patterns
5. **VALIDATE_NOSANA_JOB** → Validates Nosana job definition JSON schema
6. **REVIEW_ENV_CONFIG** → Audits .env files for secrets, localhost refs, missing vars

### Available Tools
You have 6 specialized actions:

**Agent Design (Phase 1):**
- **DESIGN_AGENT**: User describes the agent they want in plain English → generates complete character JSON with name, bio, system prompt, plugins, topics, adjectives, message examples, and style
- **SELECT_PLUGINS**: Recommends ElizaOS plugins based on requirements — knows: plugin-bootstrap, plugin-openai, plugin-anthropic, plugin-ollama, plugin-solana, plugin-evm, plugin-discord, plugin-telegram, plugin-twitter, plugin-farcaster, plugin-web-search, plugin-image-generation, plugin-pdf, plugin-video-generation

**Deployment (Phase 2):**
- **ANALYZE_DOCKERFILE**: Paste a Dockerfile to detect GPU anti-patterns (missing multi-stage, no CUDA, broken cache, no HEALTHCHECK)
- **VALIDATE_NOSANA_JOB**: Paste a Nosana job definition JSON to validate schema, image paths, port exposure, GPU config
- **REVIEW_ENV_CONFIG**: Paste .env content to detect hardcoded secrets, localhost refs, missing vars, insecure settings
- **GENERATE_DEPLOY_FILES**: Describe your project (language, framework, port) to generate Dockerfile + Nosana job JSON + .dockerignore

### Nosana GPU Markets
Valid markets: ${VALID_GPU_MARKETS.join(", ")}
Select market when deploying: \`nosana job post --file job.json --market <market>\`

### Nosana Job Definition Schema
\`\`\`json
{
  "version": "0.1",          // Required, must be "0.1"
  "type": "container",       // Optional
  "meta": { "trigger": "cli" },
  "global": { "environment": {} },
  "ops": [                    // Required, non-empty array
    {
      "type": "container/run", // Required
      "id": "unique-op-id",    // Required
      "args": {
        "image": "registry.hub.docker.com/user/image:tag", // Required, full registry path
        "gpu": true,            // Enable GPU access
        "expose": 3000,         // Port to expose (positive integer)
        "cmd": [],              // Override container CMD
        "env": {}               // Environment variables (string values)
      }
    }
  ]
}
\`\`\`

### Dockerfile Best Practices for GPU Containers
1. Use multi-stage builds (builder + runtime)
2. Use CUDA base images for runtime: ${Object.entries(CUDA_BASE_IMAGES).map(([k, v]) => `${k}: ${v}`).join(", ")}
3. Copy dependency manifests before source (layer caching)
4. Add HEALTHCHECK for readiness probes
5. Pin image tags — never use :latest
6. Minimize final image size — don't include build tools in runtime

### Required Environment Variables
For GPU services on Nosana: ${GPU_SERVICE_REQUIRED_VARS.join(", ")}

### Common Mistakes
- Using localhost URLs in env (containers can't reach host network)
- Committing .env files with real API keys
- Using bare image names without registry prefix in job definitions
- Forgetting to expose ports in both Dockerfile and job definition
- Missing HEALTHCHECK causing Nosana to mark container as unhealthy
`;

export const nosanaContextProvider: Provider = {
  name: "nosana-deploy-context",
  description: "Provides Nosana deployment knowledge: GPU markets, job definition schema, Dockerfile best practices, and common pitfalls.",
  dynamic: false,
  position: 1,
  private: false,

  get: async (_runtime, _message, _state) => {
    return {
      text: NOSANA_CONTEXT,
      values: {
        validGpuMarkets: VALID_GPU_MARKETS as unknown as string[],
        nosanaJobSchemaVersion: "0.1",
      },
      data: {
        gpuMarkets: VALID_GPU_MARKETS,
        cudaBaseImages: CUDA_BASE_IMAGES,
        requiredEnvVars: GPU_SERVICE_REQUIRED_VARS,
      },
    };
  },
};
