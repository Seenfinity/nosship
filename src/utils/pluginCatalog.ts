/**
 * ElizaOS Plugin Catalog — knowledge base for SELECT_PLUGINS action
 */

export interface PluginInfo {
  name: string;
  package: string;
  category: "core" | "llm" | "blockchain" | "client" | "utility";
  description: string;
  keywords: string[];
  requiresEnv?: string[];
}

export const ELIZAOS_PLUGIN_CATALOG: PluginInfo[] = [
  // Core
  {
    name: "Bootstrap",
    package: "@elizaos/plugin-bootstrap",
    category: "core",
    description:
      "Core plugin providing message handling, room management, embedding service, and essential agent lifecycle services. Required for all agents.",
    keywords: ["core", "bootstrap", "message", "room", "essential", "base"],
  },

  // LLM Providers
  {
    name: "OpenAI",
    package: "@elizaos/plugin-openai",
    category: "llm",
    description:
      "OpenAI model handlers for text generation, embeddings, image generation, TTS, and transcription. Works with any OpenAI-compatible endpoint (Ollama, vLLM, Nosana).",
    keywords: ["openai", "gpt", "llm", "chat", "embedding", "tts", "image", "ollama", "nosana", "vllm"],
    requiresEnv: ["OPENAI_API_KEY"],
  },
  {
    name: "Anthropic",
    package: "@elizaos/plugin-anthropic",
    category: "llm",
    description:
      "Anthropic Claude model handlers. Use when the agent should run on Claude models for text generation and reasoning.",
    keywords: ["anthropic", "claude", "llm", "reasoning"],
    requiresEnv: ["ANTHROPIC_API_KEY"],
  },
  {
    name: "Ollama",
    package: "@elizaos/plugin-ollama",
    category: "llm",
    description:
      "Local Ollama model integration. Connects to a local Ollama instance for text generation and embeddings. Auto-pulls models if not available.",
    keywords: ["ollama", "local", "llm", "self-hosted", "private"],
    requiresEnv: ["OLLAMA_API_ENDPOINT"],
  },

  // Blockchain
  {
    name: "Solana",
    package: "@elizaos/plugin-solana",
    category: "blockchain",
    description:
      "Solana blockchain integration: wallet management, token transfers, swaps (Jupiter), staking, NFT operations, and DeFi interactions.",
    keywords: ["solana", "sol", "crypto", "wallet", "swap", "jupiter", "defi", "nft", "spl", "token", "blockchain"],
    requiresEnv: ["SOLANA_PRIVATE_KEY", "SOLANA_RPC_URL"],
  },
  {
    name: "EVM",
    package: "@elizaos/plugin-evm",
    category: "blockchain",
    description:
      "Ethereum & EVM chain integration: wallet management, token transfers, swaps, and interactions with Ethereum, Polygon, Arbitrum, Base, Optimism, and other EVM chains.",
    keywords: ["ethereum", "evm", "eth", "polygon", "arbitrum", "base", "optimism", "erc20", "defi", "wallet", "crypto", "blockchain"],
    requiresEnv: ["EVM_PRIVATE_KEY"],
  },

  // Clients / Messaging Platforms
  {
    name: "Discord",
    package: "@elizaos/plugin-discord",
    category: "client",
    description:
      "Discord bot integration. The agent joins Discord servers, responds to messages, handles commands, and can manage voice channels.",
    keywords: ["discord", "chat", "bot", "community", "server", "voice"],
    requiresEnv: ["DISCORD_APPLICATION_ID", "DISCORD_API_TOKEN"],
  },
  {
    name: "Telegram",
    package: "@elizaos/plugin-telegram",
    category: "client",
    description:
      "Telegram bot integration. The agent responds to messages in Telegram chats, supports inline commands, media, and group conversations.",
    keywords: ["telegram", "chat", "bot", "messaging", "group", "notification", "alert"],
    requiresEnv: ["TELEGRAM_BOT_TOKEN"],
  },
  {
    name: "Twitter / X",
    package: "@elizaos/plugin-twitter",
    category: "client",
    description:
      "Twitter/X integration. The agent can post tweets, reply to mentions, search topics, and engage with followers. Supports automated posting schedules.",
    keywords: ["twitter", "x", "tweet", "social", "post", "mention", "feed", "media"],
    requiresEnv: ["TWITTER_USERNAME", "TWITTER_PASSWORD"],
  },
  {
    name: "Farcaster",
    package: "@elizaos/plugin-farcaster",
    category: "client",
    description:
      "Farcaster (Warpcast) integration. The agent can cast, reply, and interact on the decentralized social protocol.",
    keywords: ["farcaster", "warpcast", "cast", "social", "decentralized", "web3"],
    requiresEnv: ["FARCASTER_FID", "FARCASTER_NEYNAR_API_KEY"],
  },

  // Utility
  {
    name: "Web Search",
    package: "@elizaos/plugin-web-search",
    category: "utility",
    description:
      "Web search capability using Tavily or similar APIs. The agent can search the internet to answer questions with up-to-date information.",
    keywords: ["search", "web", "internet", "research", "tavily", "browse", "lookup"],
    requiresEnv: ["TAVILY_API_KEY"],
  },
  {
    name: "Image Generation",
    package: "@elizaos/plugin-image-generation",
    category: "utility",
    description:
      "Image generation via DALL-E, Stable Diffusion, or other providers. The agent can create images from text descriptions.",
    keywords: ["image", "generate", "art", "dalle", "stable diffusion", "picture", "visual"],
  },
  {
    name: "PDF",
    package: "@elizaos/plugin-pdf",
    category: "utility",
    description:
      "PDF document parsing and extraction. The agent can read, analyze, and extract text from PDF files.",
    keywords: ["pdf", "document", "read", "parse", "extract", "file"],
  },
  {
    name: "Video Generation",
    package: "@elizaos/plugin-video-generation",
    category: "utility",
    description:
      "Video generation capabilities. The agent can create short video clips from text prompts.",
    keywords: ["video", "generate", "clip", "animation", "media"],
  },
];

/**
 * Match plugins based on a natural language description.
 * Returns plugins sorted by relevance (number of keyword matches).
 */
export function matchPlugins(description: string): { plugin: PluginInfo; score: number; reasons: string[] }[] {
  const lower = description.toLowerCase();

  const results = ELIZAOS_PLUGIN_CATALOG.map((plugin) => {
    let score = 0;
    const reasons: string[] = [];

    for (const kw of plugin.keywords) {
      if (lower.includes(kw)) {
        score += 1;
        reasons.push(kw);
      }
    }

    // Boost core — always needed
    if (plugin.category === "core") {
      score += 5;
      reasons.push("required core plugin");
    }

    // Boost LLM — almost always needed
    if (plugin.category === "llm" && score === 0) {
      // Check if there's a generic LLM mention
      if (/\b(ai|llm|chat|convers|talk|respond|answer|gpt|model)\b/i.test(lower)) {
        score += 1;
        reasons.push("LLM capability needed");
      }
    }

    return { plugin, score, reasons };
  });

  return results
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
