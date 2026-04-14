<p align="center">
  <img src="public/logo.png" width="140" alt="NosShip" />
</p>

<h1 align="center">NosShip — Personal Agent Factory</h1>

<p align="center">
  <strong>Describe the AI agent you need. NosShip builds it, deploys it, and lets you talk to it.</strong>
</p>

<p align="center">
  <a href="https://nosana.io">Nosana GPU</a> · <a href="https://elizaos.com">ElizaOS v2</a> · <a href="#demo">Demo</a>
</p>

---

## What is NosShip?

NosShipp is a personal agent factory powered by decentralized GPUs. You describe what agent you want in plain language — a crypto price monitor, a Discord community manager, a DeFi yield hunter — and NosShip generates everything: character file with domain-specific personality, plugin stack, Dockerfile, and Nosana job definition. Then you chat directly with each agent you've created, each responding in its own voice and role.

No boilerplate. No config files. Just describe → create → chat → deploy.

## Features

- **Natural language agent creation** — one prompt generates a complete ElizaOS character with personality, knowledge, and examples
- **Smart plugin selection** — auto-picks from 14 ElizaOS plugins (Solana, Telegram, Discord, Twitter, etc.)
- **GPU-optimized deploy files** — generates Dockerfile + Nosana job definition ready for decentralized GPUs
- **Chat with your agents** — talk to each created agent using its own system prompt, with streaming responses (SSE)
- **Agent dashboard** — manage, rename, edit character files, and deploy all your agents from one UI

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | ElizaOS v2 (custom plugin) |
| LLM | Qwen3.5-27B on Nosana GPU |
| Backend | TypeScript, 6 actions, streaming proxy |
| Frontend | React 18 + Tailwind CSS (single-file SPA) |
| Infra | Nosana decentralized GPU network |

## Quick Start

```bash
git clone https://github.com/Seenfinity/nosship.git && cd nosship
pnpm install
cp .env.example .env   # configure your Nosana endpoint
pnpm exec elizaos start --character ./characters/agent.character.json
```

Open **http://localhost:3000** → start creating agents.

## Deploy to Nosana

```bash
docker build -t yourusername/my-agent:v1.0 .
docker push yourusername/my-agent:v1.0
nosana job post --file nosana-job.json --market nvidia-4090
```

## Demo

[![NosShip Demo](https://img.shields.io/badge/Watch%20Demo-X%2FTwitter-black?style=for-the-badge&logo=x)](https://x.com/seenfinity/status/2043992536868384961)

https://x.com/seenfinity/status/2043992536868384961

---

<p align="center">Built with ☀️ on <a href="https://nosana.io">Nosana</a></p>
