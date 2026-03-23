"use client";

import { cn } from "@/lib/utils";

type Step = {
  label: string;
};

export function Stepper({ steps, currentStep }: { steps: Step[]; currentStep: number }) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;

        return (
          <div
            key={step.label}
            className={cn("flex items-center", i < steps.length - 1 && "flex-1")}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "size-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors shrink-0",
                  isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  isActive && "font-semibold text-foreground",
                  isCompleted && "text-foreground",
                  !isActive && !isCompleted && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1 mx-4", isCompleted ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
