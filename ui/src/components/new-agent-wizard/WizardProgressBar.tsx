import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
}

interface WizardProgressBarProps {
  steps: Step[];
  current: number;
  onGoTo?: (step: number) => void;
}

export function WizardProgressBar({ steps, current, onGoTo }: WizardProgressBarProps) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
      {steps.map((step, i) => {
        const idx = i + 1;
        const isDone = idx < current;
        const isActive = idx === current;

        return (
          <div key={step.label} className="flex items-center gap-2 flex-1 min-w-0">
            <button
              className={cn(
                "flex items-center gap-2 shrink-0 cursor-default",
                (isDone || isActive) && onGoTo && "cursor-pointer",
              )}
              onClick={() => isDone && onGoTo?.(idx)}
              disabled={!isDone}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors",
                  isActive && "bg-primary border-primary text-primary-foreground",
                  isDone && "bg-green-500 border-green-500 text-white",
                  !isActive && !isDone && "border-border text-muted-foreground bg-background",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : idx}
              </span>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  isActive ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-px", isDone ? "bg-green-500/40" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
