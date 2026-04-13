# syntax=docker/dockerfile:1

# ── Stage 1: Build ──────────────────────────────────────────────
FROM node:23-slim AS builder

RUN apt-get update && apt-get install -y \
  python3 make g++ git curl \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

# 1. Dependencies first (layer cache)
COPY package.json ./
RUN pnpm install

# 2. Source code + compile TypeScript
COPY tsconfig.json ./
COPY src/ src/
RUN npx tsc

# 3. Create local plugin symlink so ElizaOS can load "nosship"
RUN ln -sf /app node_modules/nosship

# ── Stage 2: Runtime ────────────────────────────────────────────
FROM node:23-slim AS runtime

RUN apt-get update && apt-get install -y \
  curl git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

# Disable telemetry
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1
ENV NODE_ENV=production
ENV SERVER_PORT=3000

WORKDIR /app

# Copy built artifacts + deps from builder
COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/dist dist/
COPY --from=builder /app/package.json ./

# Recreate symlink in runtime stage
RUN ln -sf /app node_modules/nosship

# Copy static assets + character
COPY public/ public/
COPY characters/ characters/

# Data directory for SQLite
RUN mkdir -p /app/data /app/.eliza

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["pnpm", "start"]
