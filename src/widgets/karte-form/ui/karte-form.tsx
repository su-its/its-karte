"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { FOLLOW_UP_OPTIONS } from "@shizuoka-its/core";
import { LoaderIcon, SaveIcon } from "lucide-react";
import { formatConsultedAtDisplay } from "@/shared/lib";
import { Section, AssigneeReadOnly, MemberHoverContent } from "./form-parts";
import { FieldHeader, NotRecordedPill, FormField, FormTextarea } from "./form-field";

import {
  type KarteFormValues,
  type KarteFormProps,
  CLIENT_TYPES,
  PRECISION_OPTIONS,
  createInitialValues,
  canEdit as canEditField,
  fieldValue as getFieldValue,
  originalFieldValue as getOriginalFieldValue,
} from "../model/karte-form-values";

import { ConsultedAtInput } from "./consulted-at-input";
import { SearchableMultiSelect } from "@/shared/ui/searchable-multi-select";
import { AffiliationFields } from "./affiliation-fields";

export type { KarteFormValues } from "../model/karte-form-values";

// ============================================================================
// Main Component
// ============================================================================

export function KarteForm({
  members,
  categories,
  initialValues,
  onSubmit,
  submitLabel = "保存",
  readOnly = false,
  editableFields,
  onFormChange,
  unresolvedAssigneeNames = [],
  originalValues,
  onMarkNotRecorded,
}: KarteFormProps) {
  const [values, setValues] = useState<KarteFormValues>(() => createInitialValues(initialValues));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const canEdit = (field: keyof KarteFormValues) => canEditField(field, readOnly, editableFields);
  const fv = (field: keyof KarteFormValues) => getFieldValue(values, field);
  const ofv = (field: keyof KarteFormValues) => getOriginalFieldValue(originalValues, field);

  // --- Side effects ---

  useEffect(() => {
    if (!editableFields || editableFields.size === 0) return;
    const first = [...editableFields][0];
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function update() {
      if (!values.consultedAt) return;
      const diff = Date.now() - new Date(values.consultedAt).getTime();
      setElapsedMinutes(Math.max(0, Math.round(diff / 60000)));
    }
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [values.consultedAt]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onFormChange?.(values);
  }, [values, onFormChange]);

  // --- State updaters ---

  function set<K extends keyof KarteFormValues>(key: K, value: KarteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleInSet(key: "categoryIds" | "assignedMemberIds", id: string) {
    setValues((prev) => {
      const nextSet = new Set(prev[key]);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return { ...prev, [key]: nextSet };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Field props helper ---

  function fieldProps(field: keyof KarteFormValues) {
    return {
      field,
      value: fv(field),
      isEditable: canEdit(field),
      originalValue: ofv(field),
      editableFields,
      onMarkNotRecorded,
      onChange: (v: string) => set(field, v as never),
    };
  }

  // --- Derived values ---

  const isStudent = values.clientType === "student";
  const hasSubmit = !readOnly && onSubmit;
  const clientTypeLabel = CLIENT_TYPES.find((ct) => ct.value === values.clientType)?.label ?? "";
  const resolutionLabel = values.resolutionType === "resolved" ? "解決" : "未解決";

  // --- Render ---

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <Section title="相談日時">
        <FieldHeader
          field="consultedAt"
          label="相談日時"
          editableFields={editableFields}
          onMarkNotRecorded={onMarkNotRecorded}
          onClear={() => set("consultedAt", "")}
        />
        {canEdit("consultedAt") ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-1.5">
              {PRECISION_OPTIONS.map((p) => (
                <Button
                  key={p.value}
                  type="button"
                  size="sm"
                  variant={values.consultedAtPrecision === p.value ? "default" : "outline"}
                  onClick={() => {
                    set("consultedAtPrecision", p.value);
                    set("consultedAt", "");
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="max-w-xs">
              <ConsultedAtInput
                precision={values.consultedAtPrecision}
                value={values.consultedAt}
                onChange={(v) => set("consultedAt", v)}
                className={editableFields?.has("consultedAt") ? "border-destructive" : undefined}
              />
            </div>
          </div>
        ) : (
          <div className="text-sm py-2.5 px-1">
            {formatConsultedAtDisplay(values.consultedAtPrecision, values.consultedAt)}
          </div>
        )}
      </Section>

      <Section title="相談者情報">
        <FieldHeader
          field="clientType"
          label="相談者タイプ"
          editableFields={editableFields}
          onMarkNotRecorded={onMarkNotRecorded}
          onClear={() => set("clientType", "student")}
        />
        {canEdit("clientType") ? (
          <div className="flex gap-2 mb-4">
            {CLIENT_TYPES.map((ct) => (
              <Button
                key={ct.value}
                type="button"
                size="sm"
                variant={values.clientType === ct.value ? "default" : "outline"}
                onClick={() => set("clientType", ct.value)}
              >
                {ct.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <Badge variant="secondary">{clientTypeLabel}</Badge>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            {...fieldProps("clientName")}
            label="氏名"
            placeholder="例: 山田太郎"
            required
          />
          {isStudent && (
            <FormField
              {...fieldProps("studentId")}
              label="学籍番号"
              placeholder="例: 12345678"
              required
            />
          )}
        </div>

        {isStudent && (
          <AffiliationFields
            values={values}
            canEdit={canEdit}
            set={set}
            editableFields={editableFields}
            onMarkNotRecorded={onMarkNotRecorded}
          />
        )}
      </Section>

      <Section title="同意事項">
        <div className="flex gap-8">
          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={values.liabilityConsent}
                disabled={!canEdit("liabilityConsent")}
                onCheckedChange={(c) => set("liabilityConsent", !!c)}
              />
              <FieldLabel>免責事項に同意</FieldLabel>
              <NotRecordedPill
                field="liabilityConsent"
                editableFields={editableFields}
                onMarkNotRecorded={onMarkNotRecorded}
                onClear={() => set("liabilityConsent", false)}
              />
            </div>
          </Field>
          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={values.disclosureConsent}
                disabled={!canEdit("disclosureConsent")}
                onCheckedChange={(c) => set("disclosureConsent", !!c)}
              />
              <FieldLabel>情報公開に同意</FieldLabel>
              <NotRecordedPill
                field="disclosureConsent"
                editableFields={editableFields}
                onMarkNotRecorded={onMarkNotRecorded}
                onClear={() => set("disclosureConsent", false)}
              />
            </div>
          </Field>
        </div>
      </Section>

      <Section title="相談内容">
        <FieldHeader
          field="categoryIds"
          label="カテゴリ"
          editableFields={editableFields}
          onMarkNotRecorded={onMarkNotRecorded}
          onClear={() => set("categoryIds", new Set())}
        />
        <SearchableMultiSelect
          label=""
          items={categories.map((c) => ({
            id: c.id,
            label: c.displayName,
            searchText: `${c.id} ${c.displayName}`,
          }))}
          selected={values.categoryIds}
          onToggle={(id) => toggleInSet("categoryIds", id)}
          placeholder="カテゴリを検索..."
          readOnly={!canEdit("categoryIds")}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            {...fieldProps("targetDevice")}
            label="対象端末"
            placeholder="例: ノートPC (Windows)"
            required
          />
        </div>
        <div className="mt-4">
          <FormTextarea
            {...fieldProps("troubleDetails")}
            label="トラブル詳細"
            placeholder="相談者が抱えている問題の詳細を記入"
          />
        </div>
      </Section>

      <Section title="対応記録">
        <FieldHeader
          field="assignedMemberIds"
          label="担当者"
          editableFields={editableFields}
          onMarkNotRecorded={onMarkNotRecorded}
          onClear={() => set("assignedMemberIds", new Set())}
        />
        {!canEdit("assignedMemberIds") ? (
          <AssigneeReadOnly
            members={members}
            selectedIds={values.assignedMemberIds}
            unresolvedNames={unresolvedAssigneeNames}
          />
        ) : (
          <SearchableMultiSelect
            label=""
            items={members.map((m) => ({
              id: m.id,
              label: m.name,
              searchText: `${m.name} ${m.studentId ?? ""}`,
              hoverDetail: <MemberHoverContent member={m} />,
            }))}
            selected={values.assignedMemberIds}
            onToggle={(id) => toggleInSet("assignedMemberIds", id)}
            placeholder="名前・学籍番号で検索..."
          />
        )}

        <FormTextarea
          {...fieldProps("supportContent")}
          label="対応内容"
          placeholder="実施した対応の詳細を記入"
        />

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Field>
            <FieldHeader
              field="resolutionType"
              label="解決ステータス"
              editableFields={editableFields}
              onMarkNotRecorded={onMarkNotRecorded}
              onClear={() => set("resolutionType", "resolved")}
            />
            {canEdit("resolutionType") ? (
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={values.resolutionType === "resolved" ? "default" : "outline"}
                  onClick={() => set("resolutionType", "resolved")}
                >
                  解決
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={values.resolutionType === "unresolved" ? "destructive" : "outline"}
                  onClick={() => set("resolutionType", "unresolved")}
                >
                  未解決
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <Badge variant={values.resolutionType === "resolved" ? "secondary" : "destructive"}>
                  {resolutionLabel}
                </Badge>
              </div>
            )}
          </Field>

          {values.resolutionType === "unresolved" && (
            <Field>
              <FieldHeader
                field="followUp"
                label="後処理"
                editableFields={editableFields}
                onMarkNotRecorded={onMarkNotRecorded}
                onClear={() => set("followUp", "")}
              />
              {canEdit("followUp") ? (
                <Select value={values.followUp} onValueChange={(v) => v && set("followUp", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UP_OPTIONS.map((fu) => (
                      <SelectItem key={fu} value={fu}>
                        {fu}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm py-2.5 px-1">{values.followUp || "—"}</div>
              )}
            </Field>
          )}

          <FormField
            {...fieldProps("workDurationMinutes")}
            label="作業時間（分）"
            type="number"
            min={0}
            placeholder={`経過 ${elapsedMinutes}分`}
            required
          />
        </div>
      </Section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {hasSubmit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? (
              <>
                <LoaderIcon className="animate-spin" data-icon="inline-start" /> 保存中...
              </>
            ) : (
              <>
                <SaveIcon data-icon="inline-start" /> {submitLabel}
              </>
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
