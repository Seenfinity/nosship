/**
 * In-memory store for the most recently designed agent.
 * Shared between DESIGN_AGENT and GENERATE_DEPLOY_FILES so the deploy
 * step can use the agent's name, plugins, env vars, and port.
 */

export interface StoredAgentDesign {
  name: string;
  username: string;
  plugins: string[];
  envVars: string[];
  port: number;
  framework: "nodejs" | "python" | "generic";
  description: string;
  createdAt?: number;
}

let lastDesign: StoredAgentDesign | null = null;

export function storeDesign(design: StoredAgentDesign): void {
  lastDesign = { ...design, createdAt: Date.now() };
}

export function getLastDesign(): StoredAgentDesign | null {
  if (!lastDesign) return null;
  // Expire after 1 hour
  if (Date.now() - (lastDesign.createdAt ?? 0) > 3600_000) {
    lastDesign = null;
    return null;
  }
  return lastDesign;
}
