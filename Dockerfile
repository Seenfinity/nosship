# syntax=docker/dockerfile:1

FROM node:23-slim AS base

# Install system dependencies needed for native modules (e.g. better-sqlite3)
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  git \
  curl \
  && rm -rf /var/lib/apt/lists/*

# Disable telemetry
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package manifest and install dependencies
COPY package.json ./
RUN pnpm install

# Copy all source files
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["pnpm", "start"]
