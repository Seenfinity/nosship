import type { Action, ActionExample, HandlerCallback } from "@elizaos/core";
import { ELIZAOS_PLUGIN_CATALOG, matchPlugins, type PluginInfo } from "../utils/pluginCatalog.js";

function categorize(plugins: PluginInfo[]): Record<string, PluginInfo[]> {
  const grouped: Record<string, PluginInfo[]> = {};
  for (const p of plugins) {
    const cat = p.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }
  return grouped;
}

const CATEGORY_LABELS: Record<string, string> = {
  core: "Core (Required)",
  llm: "LLM Providers",
  blockchain: "Blockchain / Web3",
  client: "Clients / Platforms",
  utility: "Utilities",
};

const CATEGORY_EMOJI: Record<string, string> = {
  core: "**[CORE]**",
  llm: "**[LLM]**",
  blockchain: "**[CHAIN]**",
  client: "**[CLIENT]**",
  utility: "**[UTIL]**",
};

export const selectPlugins: Action = {
  name: "SELECT_PLUGINS",
  description:
    "Analyzes an agent's requirements and recommends the optimal set of ElizaOS plugins. Takes a natural language description of what the agent should do (platforms, capabilities, blockchain interactions) and returns a curated list with explanation for each plugin, required environment variables, and installation commands. Knows the full ElizaOS plugin ecosystem: LLM providers (OpenAI, Anthropic, Ollama), blockchain (Solana, EVM), clients (Discord, Telegram, Twitter, Farcaster), and utilities (web-search, image-generation, PDF).",
  similes: [
    "RECOMMEND_PLUGINS",
    "PICK_PLUGINS",
    "PLUGIN_SELECTION",
    "CHOOSE_PLUGINS",
    "LIST_PLUGINS",
    "WHAT_PLUGINS",
    "FIND_PLUGINS",
  ],

  validate: async () => true,

  handler: async (runtime, message, state, options, callback) => {
    const text = message.content.text || "";

    if (text.length < 10) {
      if (callback) {
        await callback({
          text: "Describe what your agent should do and I'll recommend the right plugins. Example: 'I need an agent that trades on Solana and sends alerts via Telegram.'",
        });
      }
      return { success: false, error: "Description too short" };
    }

    const matched = matchPlugins(text);
    const recommended = matched.map((m) => m.plugin);

    // Also find "maybe" plugins — those in the catalog but not matched
    const recommendedNames = new Set(recommended.map((p) => p.package));
    const notMatched = ELIZAOS_PLUGIN_CATALOG.filter(
      (p) => !recommendedNames.has(p.package)
    );

    // Build the recommended section
    const grouped = categorize(recommended);
    let report = `## Plugin Recommendations\n\n`;
    report += `Based on your description, here are the plugins your agent needs:\n\n`;

    for (const [category, label] of Object.entries(CATEGORY_LABELS)) {
      const plugins = grouped[category];
      if (!plugins || plugins.length === 0) continue;

      report += `### ${label}\n\n`;
      for (const p of plugins) {
        const emoji = CATEGORY_EMOJI[p.category] || "";
        const envNote =
          p.requiresEnv && p.requiresEnv.length > 0
            ? ` — Requires: \`${p.requiresEnv.join("`, `")}\``
            : "";
        report += `- ${emoji} **${p.name}** (\`${p.package}\`)${envNote}\n`;
        report += `  ${p.description}\n\n`;
      }
    }

    // Env vars summary
    const allEnvVars = recommended
      .filter((p) => p.requiresEnv)
      .flatMap((p) => p.requiresEnv!);
    if (allEnvVars.length > 0) {
      report += `### Required Environment Variables\n\`\`\`env\n`;
      for (const v of [...new Set(allEnvVars)]) {
        report += `${v}=your-value-here\n`;
      }
      report += `\`\`\`\n\n`;
    }

    // Install command
    const installPackages = recommended
      .filter((p) => p.package !== "@elizaos/plugin-bootstrap")
      .map((p) => p.package);
    if (installPackages.length > 0) {
      report += `### Installation\n\`\`\`bash\npnpm add ${installPackages.join(" ")}\n\`\`\`\n\n`;
    }

    // Character plugins array
    report += `### Character Config (plugins array)\n\`\`\`json\n"plugins": ${JSON.stringify(recommended.map((p) => p.package), null, 2)}\n\`\`\`\n\n`;

    // Not matched — show as "also available"
    if (notMatched.length > 0) {
      report += `### Also Available\n`;
      report += `These plugins weren't matched to your description but may be useful:\n\n`;
      for (const p of notMatched.slice(0, 6)) {
        report += `- \`${p.package}\` — ${p.description.split(".")[0]}.\n`;
      }
      report += `\n`;
    }

    report += `> Use **DESIGN_AGENT** to generate a full character file with these plugins, or **GENERATE_DEPLOY_FILES** to create deployment infrastructure.`;

    if (callback) {
      await callback({ text: report });
    }

    return {
      success: true,
      data: {
        recommended: recommended.map((p) => p.package),
        envVars: [...new Set(allEnvVars)],
        installCommand: `pnpm add ${installPackages.join(" ")}`,
      },
    };
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "What plugins do I need for an agent that trades on Solana and sends Telegram notifications?",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "## Plugin Recommendations\n\n### Core\n- plugin-bootstrap (required)\n\n### LLM\n- plugin-openai\n\n### Blockchain\n- plugin-solana — wallet, swaps, token transfers\n\n### Clients\n- plugin-telegram — bot messaging and alerts\n\nRequired env vars: OPENAI_API_KEY, SOLANA_PRIVATE_KEY, SOLANA_RPC_URL, TELEGRAM_BOT_TOKEN",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "I want to build an agent that posts on Twitter and Discord. What plugins should I use?",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "## Plugin Recommendations\n\n### Core\n- plugin-bootstrap\n\n### Clients\n- plugin-twitter — tweets, replies, mentions\n- plugin-discord — server messaging, commands\n\nInstall: pnpm add @elizaos/plugin-openai @elizaos/plugin-twitter @elizaos/plugin-discord",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: {
          text: "List all available ElizaOS plugins.",
        },
      },
      {
        name: "NosShip",
        content: {
          text: "Full ElizaOS plugin catalog: plugin-bootstrap (core), plugin-openai, plugin-anthropic, plugin-ollama (LLM), plugin-solana, plugin-evm (blockchain), plugin-discord, plugin-telegram, plugin-twitter, plugin-farcaster (clients), plugin-web-search, plugin-image-generation, plugin-pdf, plugin-video-generation (utilities).",
        },
      },
    ],
  ] as ActionExample[][],
};
