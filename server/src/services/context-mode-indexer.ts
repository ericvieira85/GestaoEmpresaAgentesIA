import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { documents, issues } from "@paperclipai/db";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveDefaultAgentWorkspaceDir } from "../home-paths.js";
import { resolveContextModeBundlePath } from "@paperclipai/adapter-claude-local/server";

const OPEN_STATUSES = ["backlog", "in_progress", "blocked"];
const MAX_DOCUMENTS = 20;
const MAX_ISSUES = 50;

function buildIndexContent(
  docs: { title: string | null; latestBody: string }[],
  agentIssues: { title: string; description: string | null; status: string; identifier: string | null }[],
): string {
  const sections: string[] = [];

  if (docs.length > 0) {
    sections.push("# Company Documents\n");
    for (const doc of docs) {
      const heading = doc.title?.trim() || "Untitled";
      sections.push(`## ${heading}\n\n${doc.latestBody.trim()}\n`);
    }
  }

  if (agentIssues.length > 0) {
    sections.push("# Assigned Issues\n");
    for (const issue of agentIssues) {
      const id = issue.identifier ?? "";
      const heading = id ? `${id}: ${issue.title}` : issue.title;
      const body = issue.description?.trim() ?? "_No description_";
      sections.push(`## ${heading}\n\n**Status:** ${issue.status}\n\n${body}\n`);
    }
  }

  return sections.join("\n---\n\n");
}

export async function indexAgentContext(
  db: Db,
  agentId: string,
  companyId: string,
): Promise<void> {
  const bundlePath = await resolveContextModeBundlePath();
  if (!bundlePath) return;

  const agentHome = resolveDefaultAgentWorkspaceDir(agentId);
  const dbDir = path.join(agentHome, ".context-mode");
  const dbPath = path.join(dbDir, "context.db");

  await fs.mkdir(dbDir, { recursive: true });

  const [docs, agentIssues] = await Promise.all([
    db
      .select({ title: documents.title, latestBody: documents.latestBody })
      .from(documents)
      .where(eq(documents.companyId, companyId))
      .orderBy(documents.updatedAt)
      .limit(MAX_DOCUMENTS),
    db
      .select({
        title: issues.title,
        description: issues.description,
        status: issues.status,
        identifier: issues.identifier,
      })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.assigneeAgentId, agentId),
          inArray(issues.status, OPEN_STATUSES),
        ),
      )
      .limit(MAX_ISSUES),
  ]);

  if (docs.length === 0 && agentIssues.length === 0) return;

  const content = buildIndexContent(docs, agentIssues);

  const transport = new StdioClientTransport({
    command: "node",
    args: [bundlePath],
    env: { ...process.env as Record<string, string>, CTX_DB_PATH: dbPath },
  });

  const client = new Client(
    { name: "paperclip-indexer", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await client.connect(transport);
    await client.callTool({ name: "ctx_index", arguments: { content } });
  } finally {
    await client.close().catch(() => {});
  }
}

export function indexAgentContextBackground(
  db: Db,
  agentId: string,
  companyId: string,
): void {
  indexAgentContext(db, agentId, companyId).catch(() => {});
}
