import { useMemo, useState } from "react";
import type { AdapterModel } from "@/api/agents";
import { cn } from "@/lib/utils";
import { listUIAdapters } from "@/adapters";
import { getAdapterDisplay } from "@/adapters/adapter-display-registry";
import { useDisabledAdaptersSync } from "@/adapters/use-disabled-adapters";
import { AgentConfigForm, type CreateConfigValues } from "@/components/AgentConfigForm";
import { ChevronDown, ChevronRight } from "lucide-react";

const SYSTEM_ADAPTER_TYPES = new Set(["process", "http"]);

interface WizardStepAdapterProps {
  configValues: CreateConfigValues;
  adapterModels: AdapterModel[] | undefined;
  adapterModelsLoading: boolean;
  onChange: (patch: Partial<CreateConfigValues>) => void;
}

export function WizardStepAdapter({
  configValues,
  adapterModels,
  adapterModelsLoading: _loading,
  onChange,
}: WizardStepAdapterProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const disabledTypes = useDisabledAdaptersSync();

  const adapterGrid = useMemo(() => {
    return listUIAdapters()
      .filter((a) => !SYSTEM_ADAPTER_TYPES.has(a.type) && !disabledTypes.has(a.type))
      .map((a) => {
        const display = getAdapterDisplay(a.type);
        return {
          value: a.type,
          label: display.label,
          description: display.description,
          icon: display.icon,
          recommended: display.recommended ?? false,
          comingSoon: display.comingSoon ?? false,
        };
      })
      .sort((a, b) => {
        if (a.recommended && !b.recommended) return -1;
        if (!a.recommended && b.recommended) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [disabledTypes]);

  return (
    <div className="space-y-5">
      {/* Adapter picker */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Adapter <span className="text-destructive">*</span>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {adapterGrid.map((opt) => {
            const Icon = opt.icon;
            const selected = configValues.adapterType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.comingSoon}
                onClick={() => {
                  if (!opt.comingSoon) {
                    onChange({ adapterType: opt.value as CreateConfigValues["adapterType"] });
                  }
                }}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/60",
                  opt.comingSoon && "opacity-40 cursor-not-allowed",
                )}
                title={opt.comingSoon ? "Coming soon" : opt.description}
                aria-pressed={selected}
              >
                {opt.recommended && (
                  <span className="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                    Recommended
                  </span>
                )}
                <Icon className="h-5 w-5 text-foreground" />
                <span className="text-xs font-semibold">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground">{opt.description}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advanced toggle — full AgentConfigForm (minus adapter picker) */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setShowAdvanced((v) => !v)}
      >
        {showAdvanced ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        {showAdvanced ? "Hide" : "Show"} model & advanced settings
      </button>

      {showAdvanced && (
        <div className="rounded-lg border border-border overflow-hidden">
          <AgentConfigForm
            mode="create"
            values={configValues}
            onChange={(patch) => onChange(patch)}
            adapterModels={adapterModels}
            showAdapterTypeField={false}
            hideInlineSave
            hideInstructionsFile
          />
        </div>
      )}

      {!showAdvanced && (
        <p className="text-xs text-muted-foreground">
          Model defaults to the adapter's recommended model. Expand above to change model, env vars, and other settings.
        </p>
      )}
    </div>
  );
}
