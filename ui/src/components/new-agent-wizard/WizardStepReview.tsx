import type { CompanySkillListItem } from "@paperclipai/shared";
import type { CreateConfigValues } from "@/components/AgentConfigForm";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { roleLabels } from "@/components/agent-config-primitives";
import { extractModelName } from "@/lib/model-utils";
import { getAdapterDisplay } from "@/adapters/adapter-display-registry";
import { DollarSign } from "lucide-react";

function estimateMonthlyCost(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "~$30–80";
  if (m.includes("sonnet")) return "~$8–25";
  if (m.includes("haiku")) return "~$1–5";
  if (m.includes("gpt-4")) return "~$20–60";
  if (m.includes("gemini-pro") || m.includes("gemini-1.5")) return "~$5–20";
  return "varies";
}

interface WizardStepReviewProps {
  name: string;
  title: string;
  effectiveRole: string;
  reportsToName: string | null;
  configValues: CreateConfigValues;
  availableSkills: CompanySkillListItem[];
  selectedSkillKeys: string[];
  onToggleSkill: (key: string, checked: boolean) => void;
  formError: string | null;
  isFirstAgent: boolean;
}

export function WizardStepReview({
  name,
  title,
  effectiveRole,
  reportsToName,
  configValues,
  availableSkills,
  selectedSkillKeys,
  onToggleSkill,
  formError,
  isFirstAgent,
}: WizardStepReviewProps) {
  const adapterDisplay = getAdapterDisplay(configValues.adapterType);
  const modelLabel = extractModelName(configValues.model) || "Default";
  const costEstimate = configValues.model ? estimateMonthlyCost(configValues.model) : "varies";

  const rows: { label: string; value: string }[] = [
    { label: "Name", value: name || "—" },
    { label: "Title", value: title || "—" },
    { label: "Role", value: roleLabels[effectiveRole] ?? effectiveRole },
    { label: "Reports to", value: reportsToName ?? (isFirstAgent ? "Board (no agent)" : "—") },
    { label: "Adapter", value: adapterDisplay.label },
    { label: "Model", value: modelLabel },
    {
      label: "Skills",
      value:
        selectedSkillKeys.length === 0
          ? "Built-in only"
          : `${selectedSkillKeys.length} optional + built-in`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Skills */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Company skills (optional)
        </p>
        {availableSkills.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No optional company skills installed yet. Built-in Paperclip skills are added automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {availableSkills.map((skill) => {
              const inputId = `skill-${skill.id}`;
              const checked = selectedSkillKeys.includes(skill.key);
              return (
                <label
                  key={skill.id}
                  htmlFor={inputId}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    checked ? "border-primary bg-primary/5" : "border-border hover:bg-accent/30",
                  )}
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    onCheckedChange={(next) => onToggleSkill(skill.key, next === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">{skill.name}</span>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground">{skill.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Built-in Paperclip runtime skills are added automatically to all agents.
        </p>
      </div>

      {/* Review card */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Review</p>
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cost estimate */}
      <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-500 shrink-0" />
          <div>
            <p className="text-xs font-medium">Estimated monthly cost</p>
            <p className="text-[11px] text-muted-foreground">≈ 8h/day, 22 working days, avg usage</p>
          </div>
        </div>
        <span className="text-lg font-semibold text-green-500">{costEstimate}</span>
      </div>

      {formError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{formError}</p>
      )}
    </div>
  );
}
