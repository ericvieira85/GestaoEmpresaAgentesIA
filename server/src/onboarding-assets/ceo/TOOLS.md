# Tools

This file documents the skills and capabilities available to you. Read it when deciding which tool to use for a given task.

## Installed skills

### `paperclip-create-agent`

Hire new agents into the company. Use when a required report does not exist and you need to create one before delegating.

**When to invoke:** any time you need to spin up a new agent — whether to fill a missing role, add capacity, or respond to a board request. Invoke before delegating work that has no current owner.

**Quality gate:** before submitting any hire request, walk the full draft-review checklist at `skills/paperclip-create-agent/references/draft-review-checklist.md` (sections A–J). No hire is submitted with open failures on that checklist. This is not optional — agents created without passing the checklist tend to produce generic, low-quality work that comes back to you as escalations.

**References inside the skill:**
- `references/agent-instruction-templates.md` — which template to use for which role
- `references/baseline-role-guide.md` — how to build an AGENTS.md from scratch when no template fits
- `references/draft-review-checklist.md` — pre-submit quality checklist (sections A–J)
- `references/agents/` — role-specific templates (coder, qa, uxdesigner, securityengineer)

---

### `para-memory-files`

Manage all memory operations: storing facts, writing daily notes, creating entities, running weekly synthesis, recalling past context, and managing plans.

**When to invoke:** any time you need to remember, retrieve, or organize anything — facts from conversations, context about ongoing projects, entity knowledge, or daily plans. Do not store facts ad-hoc in task comments; use this skill so information is retrievable across heartbeats.

**Three-layer memory system (defined in full inside the skill):**
- Knowledge graph — entities and relationships in `$AGENT_HOME/life/`
- Daily notes — timeline and plans in `$AGENT_HOME/memory/YYYY-MM-DD.md`
- Tacit knowledge — PARA folder structure for plans, resources, and archives

---

## Nomination API

Manage agent nominations before formal hiring. Use the nomination workflow for senior or board-reviewed hires.

| Action | Method + Path |
|---|---|
| Import profile (JSON or MD) | `POST /api/companies/:companyId/nominations/import` |
| List nominations | `GET /api/companies/:companyId/nominations?status=<status>` |
| Get nomination | `GET /api/nominations/:id?companyId=<id>` |
| Submit for review | `POST /api/nominations/:id/submit` |
| Endorse (CEO only) | `POST /api/nominations/:id/endorse` body: `{ note? }` |
| Manager review | `POST /api/nominations/:id/manager-review` body: `{ action: "approve"|"reject", note? }` |
| Board decide | `POST /api/nominations/:id/board-decide` body: `{ action: "approve"|"reject", note?, companyId }` |
| Withdraw | `POST /api/nominations/:id/withdraw` body: `{ reason?, companyId? }` |

**JSON import body:**
```json
{ "format": "json", "data": { "schema": "paperclip-agent-profile/v1", "name": "...", "role": "...", "title": "...", "capabilities": "...", "reportsToAgentId": "<uuid>" } }
```

**Markdown import body:**
```json
{ "format": "markdown", "content": "---\nname: ...\nrole: ...\n---\n<instructions body>" }
```

**Nomination statuses:** `draft` → `pending_ceo_endorsement` → `pending_board_approval` → `approved` | `rejected` | `withdrawn`
(When new agent reports to a non-CEO manager: `pending_manager_review` is inserted before `pending_ceo_endorsement`)

On `approved`: use `nomination.profile` as input to `paperclip-create-agent`. Still walk the full draft-review checklist — the approval is not a substitute.

---

## API access

You call the Paperclip REST API directly for all organizational operations (issues, agents, approvals, interactions). The full API reference is available at `$PAPERCLIP_API_URL/llms/openapi.yaml`.

Key environment variables:
- `PAPERCLIP_API_URL` — base URL for all API calls
- `PAPERCLIP_API_KEY` — your bearer token (include as `Authorization: Bearer $PAPERCLIP_API_KEY`)
- `PAPERCLIP_AGENT_ID` — your agent ID (use this instead of calling `GET /api/agents/me` for identity)
- `PAPERCLIP_COMPANY_ID` — your company ID
- `PAPERCLIP_TASK_ID` — the task that woke you (when set)
- `PAPERCLIP_WAKE_REASON` — why you were woken

## Adding new tools

When you acquire a new skill or gain access to a new tool, add a one-line entry here with: name, what it does, and when to use it. Keep this file current — it is your runtime reference for what you can do.
