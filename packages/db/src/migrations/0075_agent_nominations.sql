CREATE TABLE IF NOT EXISTS "agent_nominations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL,
  "nominated_by_agent_id" uuid,
  "nominated_by_user_id" text,
  "status" text NOT NULL DEFAULT 'draft',
  "profile" jsonb NOT NULL,
  "import_format" text NOT NULL DEFAULT 'json',
  "reports_to_agent_id" uuid,
  "review_chain" jsonb NOT NULL DEFAULT '[]',
  "current_step_index" integer NOT NULL DEFAULT 0,
  "decision_note" text,
  "decided_by_user_id" text,
  "decided_at" timestamp with time zone,
  "approval_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "agent_nominations" ADD CONSTRAINT "agent_nominations_company_id_companies_id_fk"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_nominations" ADD CONSTRAINT "agent_nominations_nominated_by_agent_id_agents_id_fk"
    FOREIGN KEY ("nominated_by_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_nominations" ADD CONSTRAINT "agent_nominations_reports_to_agent_id_agents_id_fk"
    FOREIGN KEY ("reports_to_agent_id") REFERENCES "agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_nominations" ADD CONSTRAINT "agent_nominations_approval_id_approvals_id_fk"
    FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "agent_nominations_company_status_idx"
  ON "agent_nominations" USING btree ("company_id", "status");

CREATE INDEX IF NOT EXISTS "agent_nominations_company_created_at_idx"
  ON "agent_nominations" USING btree ("company_id", "created_at");
