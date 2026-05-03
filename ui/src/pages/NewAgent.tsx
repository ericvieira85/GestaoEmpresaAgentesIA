import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useDialogActions } from "../context/DialogContext";
import { agentsApi } from "../api/agents";
import { companySkillsApi } from "../api/companySkills";
import { queryKeys } from "../lib/queryKeys";
import { type AdapterEnvironmentTestResult } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { agentUrl } from "../lib/utils";
import { type CreateConfigValues } from "../components/AgentConfigForm";
import { defaultCreateValues } from "../components/agent-config-defaults";
import { getUIAdapter } from "../adapters";
import { isValidAdapterType } from "../adapters/metadata";
import { buildNewAgentHirePayload } from "../lib/new-agent-hire-payload";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";
import { Upload } from "lucide-react";
import { WizardProgressBar } from "../components/new-agent-wizard/WizardProgressBar";
import { WizardStepIdentity } from "../components/new-agent-wizard/WizardStepIdentity";
import { WizardStepAdapter } from "../components/new-agent-wizard/WizardStepAdapter";
import type { CompanySkillListItem } from "@paperclipai/shared";
import { WizardStepReview } from "../components/new-agent-wizard/WizardStepReview";
import type { AgentTemplate } from "../components/new-agent-wizard/AgentTemplates";
import { parseAgentFile } from "../components/new-agent-wizard/agentFileParser";

const WIZARD_STEPS = [
  { label: "Identity" },
  { label: "Adapter & Model" },
  { label: "Skills & Review" },
];

function createValuesForAdapterType(
  adapterType: CreateConfigValues["adapterType"],
): CreateConfigValues {
  const { adapterType: _discard, ...defaults } = defaultCreateValues;
  const nextValues: CreateConfigValues = { ...defaults, adapterType };
  if (adapterType === "codex_local") {
    nextValues.model = DEFAULT_CODEX_LOCAL_MODEL;
    nextValues.dangerouslyBypassSandbox = DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
  } else if (adapterType === "gemini_local") {
    nextValues.model = DEFAULT_GEMINI_LOCAL_MODEL;
  } else if (adapterType === "cursor") {
    nextValues.model = DEFAULT_CURSOR_LOCAL_MODEL;
  } else if (adapterType === "opencode_local") {
    nextValues.model = "";
  }
  return nextValues;
}

export function NewAgent() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { openNewIssue } = useDialogActions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAdapterType = searchParams.get("adapterType");

  const [step, setStep] = useState(1);

  // Step 1 state
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setReportsTo] = useState<string | null>(null);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);

  // Step 2 state
  const [configValues, setConfigValues] = useState<CreateConfigValues>(defaultCreateValues);

  // Step 3 state
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [testAgentAction, setTestAgentAction] = useState<(() => void) | null>(null);
  const [testAgentState, setTestAgentState] = useState({ disabled: true, pending: false });
  const [testAgentFeedback, setTestAgentFeedback] = useState<{
    errorMessage: string | null;
    result: AdapterEnvironmentTestResult | null;
  }>({
    errorMessage: null,
    result: null,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: adapterModels,
    error: adapterModelsError,
    isLoading: adapterModelsLoading,
    isFetching: adapterModelsFetching,
  } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.agents.adapterModels(selectedCompanyId, configValues.adapterType)
      : ["agents", "none", "adapter-models", configValues.adapterType],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, configValues.adapterType),
    enabled: Boolean(selectedCompanyId),
  });

  const { data: companySkills } = useQuery({
    queryKey: queryKeys.companySkills.list(selectedCompanyId ?? ""),
    queryFn: () => companySkillsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: "New Agent" },
    ]);
  }, [setBreadcrumbs]);

  // Apply preset adapterType from URL
  useEffect(() => {
    if (!presetAdapterType) return;
    if (!isValidAdapterType(presetAdapterType)) return;
    setConfigValues((prev) => {
      if (prev.adapterType === presetAdapterType) return prev;
      return createValuesForAdapterType(
        presetAdapterType as CreateConfigValues["adapterType"],
      );
    });
  }, [presetAdapterType]);

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedCompanyId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Failed to create agent");
    },
  });

  function handleApplyTemplate(tpl: AgentTemplate) {
    setAppliedTemplateId(tpl.id);
    setName(tpl.name);
    setTitle(tpl.title);
    setRole(tpl.role);
    setConfigValues((prev) => ({
      ...createValuesForAdapterType(tpl.adapterType as CreateConfigValues["adapterType"]),
      promptTemplate: tpl.promptTemplate,
      // preserve any already-set values the user may have touched
      ...(prev.adapterType === tpl.adapterType ? { promptTemplate: tpl.promptTemplate } : {}),
    }));
  }

  const reportsToName =
    agents?.find((a) => a.id === reportsTo)?.name ?? null;

  const availableSkills: CompanySkillListItem[] = (companySkills ?? []).filter(
    (s) => !s.key.startsWith("paperclipai/paperclip/"),
  );

  function toggleSkill(key: string, checked: boolean) {
    setSelectedSkillKeys((prev) =>
      checked ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key),
    );
  }

  function validateStep(): string | null {
    if (step === 1 && !name.trim()) return "Agent name is required.";
    if (step === 2 && configValues.adapterType === "opencode_local") {
      const model = configValues.model.trim();
      if (!model) return "OpenCode requires an explicit model in provider/model format.";
      if (adapterModelsError)
        return adapterModelsError instanceof Error
          ? adapterModelsError.message
          : "Failed to load OpenCode models.";
      if (adapterModelsLoading || adapterModelsFetching)
        return "OpenCode models are still loading. Please wait and try again.";
      const discovered = adapterModels ?? [];
      if (!discovered.some((e) => e.id === model))
        return discovered.length === 0
          ? "No OpenCode models discovered. Run `opencode models` and authenticate providers."
          : `Configured OpenCode model is unavailable: ${model}`;
    }
    return null;
  }

  function handleNext() {
    const err = validateStep();
    if (err) { setFormError(err); return; }
    setFormError(null);
    if (step < 3) setStep((s) => s + 1);
    else handleSubmit();
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    const adapter = getUIAdapter(configValues.adapterType);
    createAgent.mutate(
      buildNewAgentHirePayload({
        name,
        effectiveRole,
        title,
        reportsTo,
        selectedSkillKeys,
        configValues,
        adapterConfig: adapter.buildAdapterConfig(configValues),
      }),
    );
  }

  // Keyboard shortcut: ⌘+Enter / Ctrl+Enter to advance
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleNext();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const ceoAgent = (agents ?? []).find((a) => a.role === "ceo");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const parsed = await parseAgentFile(file);
    if (!parsed) {
      setFormError("Could not parse file. Expected .md, .json, or .zip.");
      return;
    }
    if (parsed.isZip) {
      navigate("/company/import");
      return;
    }

    if (parsed.name) setName(parsed.name);
    if (parsed.title) setTitle(parsed.title);
    if (parsed.role && !isFirstAgent) setRole(parsed.role);
    if (parsed.reportsTo !== null) setReportsTo(parsed.reportsTo);
    if (parsed.configValues) {
      setConfigValues((prev) => ({
        ...prev,
        ...parsed.configValues,
      }));
    }
    setAppliedTemplateId(null);
    setFormError(null);
    setStep(1);
  }

  function handleAskCeo() {
    openNewIssue({
      assigneeAgentId: ceoAgent?.id,
      title: "Create a new agent",
      description: "(describe what kind of agent you want here)",
    });
    navigate("/issues");
  }

  const handleTestAgentActionChange = useCallback((fn: (() => void) | null) => {
    setTestAgentAction(() => fn);
  }, []);

  const handleTestAgentStateChange = useCallback((state: { disabled: boolean; pending: boolean }) => {
    setTestAgentState(state);
  }, []);

  const handleTestAgentFeedbackChange = useCallback((feedback: {
    errorMessage: string | null;
    result: AdapterEnvironmentTestResult | null;
  }) => {
    setTestAgentFeedback(feedback);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">New Agent</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manual advanced configuration</p>
        </div>
        <div className="flex items-center gap-3 mt-1 shrink-0">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Import from .md, .json, or .zip"
          >
            <Upload className="h-3 w-3" />
            Import from file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.mdx,.json,.zip"
            className="hidden"
            onChange={handleImportFile}
          />
          {ceoAgent && (
            <button
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={handleAskCeo}
            >
              Prefer the CEO creates it? →
            </button>
          )}
        </div>
      </div>

      {/* Wizard card */}
      <div className="border border-border rounded-lg overflow-hidden">
        <WizardProgressBar
          steps={WIZARD_STEPS}
          current={step}
          onGoTo={setStep}
        />

        <div className="p-6">
          {step === 1 && (
            <WizardStepIdentity
              agents={agents ?? []}
              isFirstAgent={isFirstAgent}
              name={name}
              title={title}
              role={effectiveRole}
              reportsTo={reportsTo}
              onName={setName}
              onTitle={setTitle}
              onRole={setRole}
              onReportsTo={setReportsTo}
              onTemplateApply={handleApplyTemplate}
              appliedTemplateId={appliedTemplateId}
            />
          )}

          {step === 2 && (
            <WizardStepAdapter
              configValues={configValues}
              adapterModels={adapterModels}
              adapterModelsLoading={adapterModelsLoading}
              onChange={(patch) => setConfigValues((prev) => ({ ...prev, ...patch }))}
            />
          )}

          {step === 3 && (
            <WizardStepReview
              name={name}
              title={title}
              effectiveRole={effectiveRole}
              reportsToName={reportsToName}
              configValues={configValues}
              availableSkills={availableSkills}
              selectedSkillKeys={selectedSkillKeys}
              onToggleSkill={toggleSkill}
              formError={formError}
              isFirstAgent={isFirstAgent}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
          <span className="text-[11px] text-muted-foreground">
            {step < 3 ? "⌘+Enter to continue" : "⌘+Enter to create"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/agents")}
            >
              Cancel
            </Button>
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFormError(null); setStep((s) => s - 1); }}
              >
                ← Back
              </Button>
            )}
            <Button
              size="sm"
              disabled={!name.trim() || createAgent.isPending}
              onClick={handleNext}
            >
              {step < 3
                ? "Continue →"
                : createAgent.isPending
                  ? "Creating…"
                  : "Create agent"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
