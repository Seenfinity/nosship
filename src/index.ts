/**
 * NosShip — Plugin: plugin-nosana-deploy
 *
 * DevOps tools for analyzing Dockerfiles, validating Nosana job definitions,
 * reviewing environment configs, and generating deployment files for GPU
 * workloads on the Nosana decentralized network.
 */

import { type Plugin } from "@elizaos/core";
import { analyzeDockerfile } from "./actions/analyzeDockerfile.js";
import { validateNosanaJob } from "./actions/validateNosanaJob.js";
import { reviewEnvConfig } from "./actions/reviewEnvConfig.js";
import { generateDeployFiles } from "./actions/generateDeployFiles.js";
import { nosanaContextProvider } from "./providers/nosanaContext.js";

export const nosanaDeployPlugin: Plugin = {
  name: "plugin-nosana-deploy",
  description:
    "DevOps tools for Nosana GPU deployments — analyze Dockerfiles, validate job definitions, review env configs, and generate deploy files.",
  actions: [analyzeDockerfile, validateNosanaJob, reviewEnvConfig, generateDeployFiles],
  providers: [nosanaContextProvider],
  evaluators: [],
};

export default nosanaDeployPlugin;
