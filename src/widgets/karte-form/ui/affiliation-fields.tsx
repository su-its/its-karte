"use client";

import { Button } from "@/shared/ui/button";
import { FieldLabel } from "@/shared/ui/field";
import { getMaxYear, getAffiliationSteps, type AffiliationStep } from "@shizuoka-its/core";
import type { KarteFormValues } from "../model/karte-form-values";
import { COURSE_TYPES } from "../model/karte-form-values";
import {
  AFFILIATION_FIELDS,
  buildSelections,
  computeAutoSkip,
  diffSelectionsToFormUpdates,
  clearAffiliation,
  toFormKey,
} from "../model/affiliation";

function AffiliationStepRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function AffiliationFields({
  values,
  canEdit,
  set,
  editableFields,
  onMarkNotRecorded,
}: {
  values: KarteFormValues;
  canEdit: (field: keyof KarteFormValues) => boolean;
  set: <K extends keyof KarteFormValues>(key: K, value: KarteFormValues[K]) => void;
  editableFields?: Set<keyof KarteFormValues>;
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
}) {
  const maxYear = getMaxYear(values.courseType);
  const editable = canEdit("courseType");
  const selections = buildSelections(values);
  const steps = values.courseType ? getAffiliationSteps(values.courseType, selections) : [];

  const affiliationPill =
    onMarkNotRecorded && editableFields?.has("faculty") ? (
      <button
        type="button"
        className="rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={() => {
          set("courseType", "" as never);
          const cleared = clearAffiliation(values);
          for (const [k, v] of Object.entries(cleared)) {
            set(k as keyof KarteFormValues, v as never);
          }
          onMarkNotRecorded("faculty");
        }}
      >
        未記録にする
      </button>
    ) : null;

  if (!editable) {
    const courseLabel = COURSE_TYPES.find((ct) => ct.value === values.courseType)?.label ?? "";
    const parts = [
      courseLabel,
      ...steps.map((step) => selections[step.field]).filter(Boolean),
      values.year ? `${values.year}年` : "",
    ].filter(Boolean);
    return (
      <div className="mt-4">
        <FieldLabel>所属</FieldLabel>
        <div className="text-sm py-2.5 px-1">{parts.join(" / ") || "—"}</div>
      </div>
    );
  }

  function applyAutoSkip(courseType: KarteFormValues["courseType"], sels: Record<string, string>) {
    const after = computeAutoSkip(courseType, sels);
    const updates = diffSelectionsToFormUpdates(sels, after);
    for (const { key, value } of updates) {
      set(key, value as never);
    }
  }

  function selectCourseType(ct: KarteFormValues["courseType"]) {
    set("courseType", ct);
    const cleared = clearAffiliation(values);
    for (const [k, v] of Object.entries(cleared)) {
      set(k as keyof KarteFormValues, v as never);
    }
    applyAutoSkip(ct, {});
  }

  function selectStep(step: AffiliationStep, value: string) {
    set(toFormKey(step.field), value as never);
    const stepIdx = steps.findIndex((s) => s.field === step.field);
    for (const s of steps.slice(stepIdx + 1)) {
      set(toFormKey(s.field), "" as never);
    }
    set("year", "" as never);
    const newSelections = { ...selections, [step.field]: value };
    applyAutoSkip(values.courseType, newSelections);
  }

  const allStepsCompleted = steps.every((step) => !!selections[step.field]);

  return (
    <div className="mt-4 flex flex-col gap-3">
      {affiliationPill && (
        <div className="flex items-center gap-2">
          <FieldLabel
            className={
              editableFields?.has("faculty") ? "text-destructive font-semibold" : undefined
            }
          >
            所属
          </FieldLabel>
          {affiliationPill}
        </div>
      )}

      <AffiliationStepRow label="課程">
        {COURSE_TYPES.map((ct) => (
          <Button
            key={ct.value}
            type="button"
            size="sm"
            variant={values.courseType === ct.value ? "default" : "outline"}
            onClick={() => selectCourseType(ct.value as KarteFormValues["courseType"])}
          >
            {ct.label}
          </Button>
        ))}
      </AffiliationStepRow>

      {steps.map((step) => {
        const stepIdx = steps.indexOf(step);
        if (stepIdx > 0 && !selections[steps[stepIdx - 1].field]) return null;

        return (
          <AffiliationStepRow key={step.field} label={step.label}>
            {step.options.map((opt) => (
              <Button
                key={opt}
                type="button"
                size="sm"
                variant={selections[step.field] === opt ? "default" : "outline"}
                onClick={() => selectStep(step, opt)}
              >
                {opt}
              </Button>
            ))}
          </AffiliationStepRow>
        );
      })}

      {allStepsCompleted && (
        <AffiliationStepRow label="学年">
          {Array.from({ length: maxYear }, (_, i) => (
            <Button
              key={i + 1}
              type="button"
              size="sm"
              variant={values.year === String(i + 1) ? "default" : "outline"}
              onClick={() => set("year", String(i + 1) as never)}
            >
              {i + 1}年
            </Button>
          ))}
        </AffiliationStepRow>
      )}
    </div>
  );
}
