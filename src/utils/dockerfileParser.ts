export interface DockerStage {
  name: string | null;
  baseImage: string;
  lineNumber: number;
}

export interface DockerInstruction {
  type: string;
  args: string;
  lineNumber: number;
}

export interface DockerfileAnalysis {
  stages: DockerStage[];
  instructions: DockerInstruction[];
  hasHealthcheck: boolean;
  hasCudaBase: boolean;
  hasMultiStage: boolean;
  copyBeforeInstall: boolean;
  hasExposeInstruction: boolean;
  usesLatestTag: boolean;
  estimatedLayers: number;
}

const CUDA_IMAGE_PATTERNS = [
  /nvidia\/cuda/i,
  /nvcr\.io/i,
  /cudnn/i,
];

const INSTALL_COMMANDS = [
  /npm\s+install/,
  /npm\s+ci/,
  /pnpm\s+install/,
  /yarn\s+install/,
  /pip\s+install/,
  /pip3\s+install/,
  /poetry\s+install/,
  /cargo\s+build/,
  /go\s+mod\s+download/,
];

const BROAD_COPY_PATTERNS = [
  /^COPY\s+\.\s/,
  /^COPY\s+\.\s*$/,
  /^COPY\s+\.\/\s/,
];

export function parseDockerfile(content: string): DockerfileAnalysis {
  const lines = content.split("\n");
  const stages: DockerStage[] = [];
  const instructions: DockerInstruction[] = [];
  let hasHealthcheck = false;
  let hasExposeInstruction = false;
  let usesLatestTag = false;
  let estimatedLayers = 0;

  let firstBroadCopyLine = -1;
  let firstInstallLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) continue;

    // Parse instruction type
    const match = line.match(/^([A-Z]+)\s+(.*)/s);
    if (!match) continue;

    const [, type, args] = match;
    instructions.push({ type, args, lineNumber });

    switch (type) {
      case "FROM": {
        const fromMatch = args.match(/^(\S+?)(?:\s+[Aa][Ss]\s+(\S+))?$/);
        if (fromMatch) {
          const baseImage = fromMatch[1];
          const name = fromMatch[2] || null;
          stages.push({ name, baseImage, lineNumber });

          if (baseImage.endsWith(":latest") || !baseImage.includes(":")) {
            usesLatestTag = true;
          }
        }
        break;
      }
      case "HEALTHCHECK":
        hasHealthcheck = true;
        break;
      case "EXPOSE":
        hasExposeInstruction = true;
        break;
      case "RUN":
        estimatedLayers++;
        if (INSTALL_COMMANDS.some((p) => p.test(args)) && firstInstallLine === -1) {
          firstInstallLine = lineNumber;
        }
        break;
      case "COPY":
      case "ADD":
        estimatedLayers++;
        if (BROAD_COPY_PATTERNS.some((p) => p.test(line)) && firstBroadCopyLine === -1) {
          firstBroadCopyLine = lineNumber;
        }
        break;
    }
  }

  const hasCudaBase = stages.some((s) =>
    CUDA_IMAGE_PATTERNS.some((p) => p.test(s.baseImage))
  );

  const hasMultiStage = stages.length > 1;

  // Cache is broken if a broad COPY (COPY . .) appears before the first install command
  const copyBeforeInstall =
    firstBroadCopyLine !== -1 &&
    firstInstallLine !== -1 &&
    firstBroadCopyLine < firstInstallLine;

  return {
    stages,
    instructions,
    hasHealthcheck,
    hasCudaBase,
    hasMultiStage,
    copyBeforeInstall,
    hasExposeInstruction,
    usesLatestTag,
    estimatedLayers,
  };
}
