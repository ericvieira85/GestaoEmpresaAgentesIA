import { useEffect } from "react";
import type { Agent } from "@paperclipai/shared";
import { AGENT_ROLES } from "@paperclipai/shared";
import { cn } from "@/lib/utils";
import { roleLabels } from "@/components/agent-config-primitives";
import { ReportsToPicker } from "@/components/ReportsToPicker";
import { AGENT_TEMPLATES, type AgentTemplate } from "./AgentTemplates";

interface WizardStepIdentityProps {
  agents: Agent[];
  isFirstAgent: boolean;
  name: string;
  title: string;
  role: string;
  reportsTo: string | null;
  onName: (v: string) => void;
  onTitle: (v: string) => void;
  onRole: (v: string) => void;
  onReportsTo: (v: string | null) => void;
  onTemplateApply: (t: AgentTemplate) => void;
  appliedTemplateId: string | null;
}

export function WizardStepIdentity({
  agents,
  isFirstAgent,
  name,
  title,
  role,
  reportsTo,
  onName,
  onTitle,
  onRole,
  onReportsTo,
  onTemplateApply,
  appliedTemplateId,
}: WizardStepIdentityProps) {
  useEffect(() => {
    if (isFirstAgent && !appliedTemplateId) {
      const ceoTpl = AGENT_TEMPLATES.find((t) => t.id === "ceo")!;
      onTemplateApply(ceoTpl);
    }
  }, [isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTemplates = isFirstAgent
    ? AGENT_TEMPLATES.filter((t) => t.id === "ceo")
    : AGENT_TEMPLATES;

  return (
    <div className="space-y-5">
      {/* Templates */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Start from a template
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleTemplates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onTemplateApply(tpl)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors hover:border-primary/60",
                appliedTemplateId === tpl.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card",
              )}
            >
              <span className="text-lg">{tpl.emoji}</span>
              <span className="text-xs font-semibold">{tpl.name}</span>
              <span className="text-[11px] text-muted-foreground leading-tight">{tpl.title}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Pre-fills name, title, and role. Edit freely after.
        </p>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Name <span className="text-destructive">*</span>
        </label>
        <input
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
          placeholder="e.g. Alice, João, Bot-01"
          value={name}
          onChange={(e) => onName(e.target.value)}
          autoFocus
        />
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Job title
        </label>
        <input
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
          placeholder="e.g. VP of Engineering, Tech Lead"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          System role
        </label>
        {isFirstAgent ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-md border border-border bg-muted text-sm font-medium">
              CEO
            </span>
            <span className="text-xs text-muted-foreground">
              First agent is always the CEO.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {AGENT_ROLES.map((r) => (
              <button
                key={r}
                onClick={() => onRole(r)}
                className={cn(
                  "px-2.5 py-1 rounded-md border text-xs font-medium transition-colors",
                  r === role
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-border/80 hover:bg-accent/50",
                )}
              >
                {roleLabels[r] ?? r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reports To */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Reports to
        </label>
        <ReportsToPicker
          agents={agents}
          value={reportsTo}
          onChange={onReportsTo}
          disabled={isFirstAgent}
        />
        {isFirstAgent && (
          <p className="text-[11px] text-muted-foreground mt-1">
            CEO reports to the Board (no agent).
          </p>
        )}
      </div>
    </div>
  );
}
