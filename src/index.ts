/**
 * NosShip — Plugin: plugin-nosana-deploy
 *
 * DevOps tools for analyzing Dockerfiles, validating Nosana job definitions,
 * reviewing environment configs, and generating deployment files for GPU
 * workloads on the Nosana decentralized network.
 *
 * Also registers model handlers that use /chat/completions instead of /responses,
 * since the Nosana endpoint (Ollama-based) does not support the Responses API.
 */

import { type Plugin } from "@elizaos/core";
import { analyzeDockerfile } from "./actions/analyzeDockerfile.js";
import { validateNosanaJob } from "./actions/validateNosanaJob.js";
import { reviewEnvConfig } from "./actions/reviewEnvConfig.js";
import { generateDeployFiles } from "./actions/generateDeployFiles.js";
import { designAgent } from "./actions/designAgent.js";
import { selectPlugins } from "./actions/selectPlugins.js";
import { nosanaContextProvider } from "./providers/nosanaContext.js";
import { handleTextSmall, handleTextLarge } from "./models/chatCompletions.js";
import { nosshipRoutes } from "./routes/nosshipRoutes.js";

export const nosanaDeployPlugin: Plugin = {
  name: "plugin-nosana-deploy",
  description:
    "Personal Agent Factory for Nosana — design agents from natural language, select plugins, analyze Dockerfiles, validate job definitions, review env configs, and generate deploy files.",
  actions: [designAgent, selectPlugins, analyzeDockerfile, validateNosanaJob, reviewEnvConfig, generateDeployFiles],
  providers: [nosanaContextProvider],
  evaluators: [],
  routes: nosshipRoutes,

  // Override TEXT_SMALL and TEXT_LARGE to use /chat/completions
  // instead of /responses (which Nosana/Ollama doesn't support)
  models: {
    TEXT_SMALL: handleTextSmall,
    TEXT_LARGE: handleTextLarge,
  },

  // Higher priority ensures our model handlers override plugin-openai's
  priority: 100,
};

export default nosanaDeployPlugin;
