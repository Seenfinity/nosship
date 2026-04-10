import { describe, it, expect } from "vitest";
import { parseDockerfile } from "../utils/dockerfileParser.js";

describe("parseDockerfile", () => {
  it("detects a single-stage build (no multi-stage)", () => {
    const content = `FROM node:23-slim
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.hasMultiStage).toBe(false);
    expect(result.stages).toHaveLength(1);
    expect(result.stages[0].baseImage).toBe("node:23-slim");
    expect(result.stages[0].name).toBeNull();
  });

  it("detects multi-stage builds", () => {
    const content = `FROM node:23-slim AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nvidia/cuda:12.1.0-base-ubuntu22.04
COPY --from=builder /app/dist /app
CMD ["node", "/app/index.js"]`;

    const result = parseDockerfile(content);
    expect(result.hasMultiStage).toBe(true);
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0].name).toBe("builder");
    expect(result.stages[1].name).toBeNull();
  });

  it("detects CUDA base images", () => {
    const content = `FROM nvidia/cuda:12.1.0-base-ubuntu22.04
WORKDIR /app
CMD ["python3", "main.py"]`;

    const result = parseDockerfile(content);
    expect(result.hasCudaBase).toBe(true);
  });

  it("flags missing CUDA base image", () => {
    const content = `FROM python:3.11-slim
WORKDIR /app
CMD ["python3", "main.py"]`;

    const result = parseDockerfile(content);
    expect(result.hasCudaBase).toBe(false);
  });

  it("detects HEALTHCHECK instruction", () => {
    const content = `FROM node:23-slim
HEALTHCHECK --interval=30s CMD curl -f http://localhost:3000/ || exit 1
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.hasHealthcheck).toBe(true);
  });

  it("flags missing HEALTHCHECK", () => {
    const content = `FROM node:23-slim
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.hasHealthcheck).toBe(false);
  });

  it("detects broken layer caching (COPY . before install)", () => {
    const content = `FROM node:23-slim
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.copyBeforeInstall).toBe(true);
  });

  it("recognizes proper caching order (manifest before source)", () => {
    const content = `FROM node:23-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.copyBeforeInstall).toBe(false);
  });

  it("detects :latest tag usage", () => {
    const content = `FROM node:latest
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.usesLatestTag).toBe(true);
  });

  it("detects missing tag (implies latest)", () => {
    const content = `FROM node
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.usesLatestTag).toBe(true);
  });

  it("does not flag pinned tags", () => {
    const content = `FROM node:23-slim
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.usesLatestTag).toBe(false);
  });

  it("detects EXPOSE instruction", () => {
    const content = `FROM node:23-slim
EXPOSE 3000
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.hasExposeInstruction).toBe(true);
  });

  it("counts layers from RUN, COPY, and ADD", () => {
    const content = `FROM node:23-slim
WORKDIR /app
RUN apt-get update
RUN apt-get install -y curl
COPY package.json .
RUN npm install
COPY . .
RUN npm run build
ADD extra.tar.gz /app`;

    const result = parseDockerfile(content);
    // 4 RUN + 2 COPY + 1 ADD = 7
    expect(result.estimatedLayers).toBe(7);
  });

  it("skips comments and empty lines", () => {
    const content = `# This is a comment
FROM node:23-slim

# Another comment
WORKDIR /app
CMD ["node", "index.js"]`;

    const result = parseDockerfile(content);
    expect(result.stages).toHaveLength(1);
    expect(result.instructions).toHaveLength(3); // FROM, WORKDIR, CMD
  });

  it("detects pip install as install command", () => {
    const content = `FROM python:3.11-slim
COPY . .
RUN pip install -r requirements.txt
CMD ["python3", "main.py"]`;

    const result = parseDockerfile(content);
    expect(result.copyBeforeInstall).toBe(true);
  });

  it("handles nvcr.io as CUDA image", () => {
    const content = `FROM nvcr.io/nvidia/pytorch:24.01-py3
CMD ["python3", "train.py"]`;

    const result = parseDockerfile(content);
    expect(result.hasCudaBase).toBe(true);
  });
});
