/**
 * NosShip API routes — CRUD for agent designs + serve custom UI.
 * Mounted at /api/agents/{agentId}/plugins/...
 */

import type { Route } from "@elizaos/core";
import fs from "node:fs";
import path from "node:path";

const DESIGNS_DIR = path.resolve(process.cwd(), ".eliza");
const DESIGNS_FILE = path.join(DESIGNS_DIR, "nosship-designs.json");

/* ------------------------------------------------------------------ */
/*  Persistence helpers                                                */
/* ------------------------------------------------------------------ */

interface DesignRecord {
  id: string;
  name: string;
  username: string;
  domain: string;
  description: string;
  plugins: string[];
  envVars: string[];
  characterJson: string;
  deployFiles?: {
    dockerfile: string;
    jobDefinition: string;
    dockerignore: string;
    envFile: string;
  };
  status: "created" | "ready-to-deploy" | "deployed";
  createdAt: number;
  updatedAt: number;
}

function ensureDir(): void {
  if (!fs.existsSync(DESIGNS_DIR)) {
    fs.mkdirSync(DESIGNS_DIR, { recursive: true });
  }
}

function readDesigns(): DesignRecord[] {
  ensureDir();
  if (!fs.existsSync(DESIGNS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DESIGNS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeDesigns(designs: DesignRecord[]): void {
  ensureDir();
  fs.writeFileSync(DESIGNS_FILE, JSON.stringify(designs, null, 2), "utf-8");
}

/* ------------------------------------------------------------------ */
/*  UI route — serves the SPA HTML                                     */
/* ------------------------------------------------------------------ */

function getUIHtml(): string {
  const htmlPath = path.resolve(process.cwd(), "public", "index.html");
  if (fs.existsSync(htmlPath)) {
    return fs.readFileSync(htmlPath, "utf-8");
  }
  return "<html><body><h1>NosShip UI not found</h1><p>Expected at: public/index.html</p></body></html>";
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

function getMimeType(ext: string): string {
  const mimes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".css": "text/css",
    ".js": "application/javascript",
  };
  return mimes[ext] || "application/octet-stream";
}

export const nosshipRoutes: Route[] = [
  // Serve the NosShip UI (fallback; primary serving is via inject-ui.mjs)
  {
    type: "GET",
    path: "/app",
    name: "nosship-ui",
    public: true,
    handler: async (_req, res) => {
      const html = getUIHtml();
      if (res.setHeader) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
      }
      res.send(html);
    },
  },

  // Serve static assets from public/
  {
    type: "GET",
    path: "/assets/:filename",
    name: "nosship-static",
    public: true,
    handler: async (req, res) => {
      const filename = req.params?.filename;
      if (!filename || filename.includes("..") || filename.includes("/")) {
        res.status(400).json({ error: "Invalid filename" });
        return;
      }
      const filePath = path.resolve(process.cwd(), "public", filename);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const ext = path.extname(filename).toLowerCase();
      if (res.setHeader) {
        res.setHeader("Content-Type", getMimeType(ext));
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
      const raw = res as any;
      raw.end(fs.readFileSync(filePath));
    },
  },

  // List all designs
  {
    type: "GET",
    path: "/designs",
    name: "list-designs",
    public: true,
    handler: async (_req, res) => {
      const designs = readDesigns();
      res.json({ success: true, data: designs });
    },
  },

  // Create a design
  {
    type: "POST",
    path: "/designs",
    name: "create-design",
    public: true,
    handler: async (req, res) => {
      const body = req.body as Partial<DesignRecord>;
      if (!body.name || !body.characterJson) {
        res.status(400).json({ success: false, error: "name and characterJson required" });
        return;
      }
      const designs = readDesigns();
      const record: DesignRecord = {
        id: body.id || crypto.randomUUID(),
        name: body.name,
        username: body.username || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        domain: body.domain || "general",
        description: body.description || "",
        plugins: body.plugins || [],
        envVars: body.envVars || [],
        characterJson: body.characterJson,
        deployFiles: body.deployFiles,
        status: body.deployFiles ? "ready-to-deploy" : "created",
        createdAt: body.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      designs.push(record);
      writeDesigns(designs);
      res.json({ success: true, data: record });
    },
  },

  // Get one design
  {
    type: "GET",
    path: "/designs/:id",
    name: "get-design",
    public: true,
    handler: async (req, res) => {
      const designs = readDesigns();
      const design = designs.find((d) => d.id === req.params?.id);
      if (!design) {
        res.status(404).json({ success: false, error: "Design not found" });
        return;
      }
      res.json({ success: true, data: design });
    },
  },

  // Update a design
  {
    type: "PUT",
    path: "/designs/:id",
    name: "update-design",
    public: true,
    handler: async (req, res) => {
      const designs = readDesigns();
      const idx = designs.findIndex((d) => d.id === req.params?.id);
      if (idx === -1) {
        res.status(404).json({ success: false, error: "Design not found" });
        return;
      }
      const body = req.body as Partial<DesignRecord>;
      designs[idx] = {
        ...designs[idx],
        ...body,
        id: designs[idx].id,
        createdAt: designs[idx].createdAt,
        updatedAt: Date.now(),
      };
      if (body.deployFiles && designs[idx].status === "created") {
        designs[idx].status = "ready-to-deploy";
      }
      writeDesigns(designs);
      res.json({ success: true, data: designs[idx] });
    },
  },

  // Delete a design
  {
    type: "DELETE",
    path: "/designs/:id",
    name: "delete-design",
    public: true,
    handler: async (req, res) => {
      let designs = readDesigns();
      const before = designs.length;
      designs = designs.filter((d) => d.id !== req.params?.id);
      if (designs.length === before) {
        res.status(404).json({ success: false, error: "Design not found" });
        return;
      }
      writeDesigns(designs);
      res.json({ success: true });
    },
  },

  // Streaming chat proxy to Nosana LLM (SSE)
  {
    type: "POST",
    path: "/chat",
    name: "agent-chat-proxy",
    public: true,
    handler: async (req, res) => {
      const raw = res as any; // access underlying Express write/end for SSE
      const baseUrl =
        process.env.OPENAI_API_URL ||
        process.env.OPENAI_BASE_URL ||
        "https://4fobHJEHBxVppziJnUir4GXEJQEsC2JdR4WJqSU7nNKc.node.k8s.prd.nos.ci/v1";
      const apiKey = process.env.OPENAI_API_KEY || "nosana";
      const model =
        process.env.OPENAI_LARGE_MODEL ||
        process.env.MODEL_NAME ||
        "qwen3.5:27b";

      const body = req.body as {
        messages?: Array<{ role: string; content: string }>;
      };

      if (!body.messages || !Array.isArray(body.messages)) {
        res.status(400).json({ success: false, error: "messages array required" });
        return;
      }

      try {
        const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";
        const upstream = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: body.messages,
            temperature: 0.7,
            max_tokens: 8192,
            stream: true,
          }),
        });

        if (!upstream.ok) {
          const errText = await upstream.text();
          res
            .status(upstream.status)
            .json({ success: false, error: errText });
          return;
        }

        // Set SSE headers
        if (res.setHeader) {
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("X-Accel-Buffering", "no");
        }

        // Pipe upstream SSE chunks to client
        const reader = (upstream.body as any)?.getReader?.();
        if (!reader) {
          // Fallback: non-streaming response
          const data = await upstream.json();
          const text = data?.choices?.[0]?.message?.content || "(no response)";
          raw.write(`data: ${JSON.stringify({ text })}\n\n`);
          raw.write("data: [DONE]\n\n");
          raw.end();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);

            if (payload === "[DONE]") {
              raw.write("data: [DONE]\n\n");
              continue;
            }

            try {
              const chunk = JSON.parse(payload);
              const token = chunk.choices?.[0]?.delta?.content;
              if (token) {
                raw.write(`data: ${JSON.stringify({ text: token })}\n\n`);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Flush remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
            try {
              const chunk = JSON.parse(trimmed.slice(6));
              const token = chunk.choices?.[0]?.delta?.content;
              if (token) {
                raw.write(`data: ${JSON.stringify({ text: token })}\n\n`);
              }
            } catch {}
          }
        }

        raw.write("data: [DONE]\n\n");
        raw.end();
      } catch (err: any) {
        try {
          raw.write(`data: ${JSON.stringify({ error: err?.message || "LLM proxy error" })}\n\n`);
          raw.write("data: [DONE]\n\n");
          raw.end();
        } catch {
          res
            .status(502)
            .json({ success: false, error: err?.message || "LLM proxy error" });
        }
      }
    },
  },
];
