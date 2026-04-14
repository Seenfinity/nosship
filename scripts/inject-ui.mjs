#!/usr/bin/env node
/**
 * inject-ui — Replace the default ElizaOS client index.html with NosShip's custom UI.
 *
 * Finds the @elizaos/server dist/client directory (where express.static serves from)
 * and copies public/index.html there. This ensures localhost:3000 shows NosShip,
 * not the default ElizaOS frontend.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "public", "index.html");

if (!fs.existsSync(SOURCE)) {
  console.error("[inject-ui] public/index.html not found — skipping");
  process.exit(0);
}

// Walk node_modules to find @elizaos/server dist/client
function findClientDir(base) {
  const patterns = [
    // pnpm flat layout
    path.join(base, "node_modules", ".pnpm"),
    // npm/yarn hoisted
    path.join(base, "node_modules", "@elizaos", "server", "dist", "client"),
  ];

  // Check direct hoisted path first
  const hoisted = patterns[1];
  if (fs.existsSync(path.join(hoisted, "index.html"))) {
    return hoisted;
  }

  // Search pnpm .pnpm directory
  const pnpmDir = patterns[0];
  if (!fs.existsSync(pnpmDir)) return null;

  for (const entry of fs.readdirSync(pnpmDir)) {
    if (!entry.startsWith("@elizaos+server@")) continue;
    const clientDir = path.join(
      pnpmDir,
      entry,
      "node_modules",
      "@elizaos",
      "server",
      "dist",
      "client"
    );
    if (fs.existsSync(clientDir)) return clientDir;
  }

  return null;
}

const clientDir = findClientDir(ROOT);

if (!clientDir) {
  console.warn("[inject-ui] @elizaos/server client dir not found — skipping");
  process.exit(0);
}

// Back up original if not already backed up
const target = path.join(clientDir, "index.html");
const backup = path.join(clientDir, "index.html.original");
if (fs.existsSync(target) && !fs.existsSync(backup)) {
  fs.copyFileSync(target, backup);
}

// Copy our custom UI
fs.copyFileSync(SOURCE, target);
console.log(`[inject-ui] Injected NosShip UI into ${clientDir}`);
