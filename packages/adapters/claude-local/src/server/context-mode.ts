import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveContextModeRoot(): string | null {
  try {
    // context-mode main export: ./build/opencode-plugin.js
    // dirname x2 from that file = package root
    const mainUrl = import.meta.resolve("context-mode");
    return path.dirname(path.dirname(fileURLToPath(mainUrl)));
  } catch {
    return null;
  }
}

export async function resolveContextModeBundlePath(): Promise<string | null> {
  const override = process.env.CONTEXT_MODE_SERVER_BUNDLE;
  if (override?.trim()) return override.trim();

  const root = resolveContextModeRoot();
  if (!root) return null;

  const bundle = path.join(root, "server.bundle.mjs");
  try {
    await fs.access(bundle);
    return bundle;
  } catch {
    return null;
  }
}

export async function ensureAgentContextModeConfig(agentHome: string): Promise<void> {
  const bundlePath = await resolveContextModeBundlePath();
  if (!bundlePath) return;

  const claudeDir = path.join(agentHome, ".claude");
  const dbPath = path.join(agentHome, ".context-mode", "context.db");
  const settingsPath = path.join(claudeDir, "settings.json");

  await fs.mkdir(claudeDir, { recursive: true });
  await fs.mkdir(path.join(agentHome, ".context-mode"), { recursive: true });

  const existing = await fs.readFile(settingsPath, "utf-8")
    .then((raw) => JSON.parse(raw) as Record<string, unknown>)
    .catch(() => ({}) as Record<string, unknown>);

  const mcpServers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};

  const merged = {
    ...existing,
    mcpServers: {
      ...mcpServers,
      "context-mode": {
        type: "stdio",
        command: "node",
        args: [bundlePath],
        env: { CTX_DB_PATH: dbPath },
      },
    },
  };

  await fs.writeFile(settingsPath, JSON.stringify(merged, null, 2));
}
