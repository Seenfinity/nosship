// Valid GPU markets on the Nosana network
export const VALID_GPU_MARKETS = [
  "nvidia-3090",
  "nvidia-4090",
] as const;

export type GpuMarket = (typeof VALID_GPU_MARKETS)[number];

// Recommended CUDA base images by framework
export const CUDA_BASE_IMAGES: Record<string, string> = {
  pytorch: "nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04",
  tensorflow: "nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04",
  generic: "nvidia/cuda:12.1.0-base-ubuntu22.04",
  development: "nvidia/cuda:12.1.0-devel-ubuntu22.04",
};

// Nosana job definition required schema structure
export const NOSANA_JOB_REQUIRED_FIELDS = {
  topLevel: ["version", "ops"] as const,
  opFields: ["type", "id", "args"] as const,
  argsFields: ["image"] as const,
  validVersion: "0.1",
  validOpTypes: ["container/run"] as const,
};

// Regex patterns for detecting hardcoded secrets
export const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub Token (classic)", pattern: /ghp_[A-Za-z0-9_]{36}/ },
  { name: "GitHub OAuth Token", pattern: /gho_[A-Za-z0-9_]{36}/ },
  { name: "GitLab Token", pattern: /glpat-[A-Za-z0-9\-_]{20,}/ },
  { name: "OpenAI API Key", pattern: /sk-[A-Za-z0-9]{32,}/ },
  { name: "Slack Token", pattern: /xox[bporas]-[A-Za-z0-9\-]+/ },
  { name: "Private Key Block", pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: "Generic Secret", pattern: /(?:password|secret|token|apikey|api_key)\s*[=:]\s*["']?[A-Za-z0-9+/=]{16,}["']?/i },
];

// Patterns that indicate localhost references (won't work in Nosana containers)
export const LOCALHOST_PATTERNS: RegExp[] = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /host\.docker\.internal/i,
];

// Placeholder values that should NOT be flagged as secrets
export const PLACEHOLDER_VALUES = [
  "your-key-here",
  "your-api-key",
  "changeme",
  "replace-me",
  "TODO",
  "xxx",
  "nosana",
  "ollama",
  "sk-placeholder",
  "test",
];

// Required environment variables for GPU services on Nosana
export const GPU_SERVICE_REQUIRED_VARS = [
  "OPENAI_API_KEY",
  "OPENAI_API_URL",
  "MODEL_NAME",
  "SERVER_PORT",
];

// Known registries for image validation
export const KNOWN_REGISTRIES = [
  "registry.hub.docker.com",
  "docker.io",
  "ghcr.io",
  "gcr.io",
  "nvcr.io",
  "quay.io",
  "public.ecr.aws",
];
