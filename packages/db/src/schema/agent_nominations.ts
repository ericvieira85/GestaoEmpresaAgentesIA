import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { approvals } from "./approvals.js";

export const agentNominations = pgTable(
  "agent_nominations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    nominatedByAgentId: uuid("nominated_by_agent_id").references(() => agents.id),
    nominatedByUserId: text("nominated_by_user_id"),
    status: text("status").notNull().default("draft"),
    profile: jsonb("profile").$type<Record<string, unknown>>().notNull(),
    importFormat: text("import_format").notNull().default("json"),
    reportsToAgentId: uuid("reports_to_agent_id").references(() => agents.id),
    reviewChain: jsonb("review_chain").$type<Array<Record<string, unknown>>>().notNull().default([]),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    decisionNote: text("decision_note"),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    approvalId: uuid("approval_id").references(() => approvals.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("agent_nominations_company_status_idx").on(table.companyId, table.status),
    companyCreatedAtIdx: index("agent_nominations_company_created_at_idx").on(table.companyId, table.createdAt),
  }),
);
