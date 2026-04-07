"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Field, FieldLabel } from "@/shared/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/shared/ui/hover-card";
import { Separator } from "@/shared/ui/separator";
import { FOLLOW_UP_OPTIONS } from "@shizuoka-its/core";
import { LoaderIcon, SaveIcon } from "lucide-react";
import { formatConsultedAtDisplay } from "@/shared/lib";
import type { MemberOption } from "@/shared/api";

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

  const onFormChangeRef = useRef(onFormChange);
  onFormChangeRef.current = onFormChange;
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onFormChangeRef.current?.(values);
  }, [values]);

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

  // --- Derived values ---

  const isStudent = values.clientType === "student";
  const hasSubmit = !readOnly && onSubmit;
  const fv = (field: keyof KarteFormValues) => getFieldValue(values, field);
  const ofv = (field: keyof KarteFormValues) => getOriginalFieldValue(originalValues, field);

  // --- Sub-components (tightly coupled to form context) ---

  function OriginalValueHint({ field }: { field: keyof KarteFormValues }) {
    if (!editableFields?.has(field)) return null;
    const orig = ofv(field);
    if (orig === undefined) return null;
    return (
      <div className="text-xs text-muted-foreground mb-1">
        修正前: <span className="font-mono">{orig || "（空）"}</span>
      </div>
    );
  }

  function NotRecordedPill({
    field,
    clearValue,
  }: {
    field: keyof KarteFormValues;
    clearValue?: () => void;
  }) {
    if (!onMarkNotRecorded || !editableFields?.has(field)) return null;
    return (
      <button
        type="button"
        className="rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={() => {
          clearValue ? clearValue() : set(field, "" as never);
          onMarkNotRecorded(field);
        }}
      >
        未記録にする
      </button>
    );
  }

  function FieldHeader({ field, label }: { field: keyof KarteFormValues; label: string }) {
    return (
      <div className="flex items-center gap-2" data-field={field}>
        <FieldLabel
          className={editableFields?.has(field) ? "text-destructive font-semibold" : undefined}
        >
          {label}
        </FieldLabel>
        <NotRecordedPill field={field} />
      </div>
    );
  }

  function renderField(
    field: keyof KarteFormValues,
    label: string,
    opts?: { type?: string; placeholder?: string; required?: boolean; min?: number; max?: number },
  ) {
    const val = fv(field);
    const isEditable = canEdit(field);
    const orig = ofv(field);
    const isModified = isEditable && orig !== undefined && orig !== val;
    return (
      <Field>
        <FieldHeader field={field} label={label} />
        <OriginalValueHint field={field} />
        {isEditable ? (
          <Input
            type={opts?.type}
            min={opts?.min}
            max={opts?.max}
            value={val}
            onChange={(e) => set(field, e.target.value as never)}
            placeholder={opts?.placeholder}
            required={opts?.required}
            className={
              isModified
                ? "border-green-500"
                : editableFields?.has(field)
                  ? "border-destructive"
                  : undefined
            }
          />
        ) : (
          <div className="text-sm py-2.5 px-1 min-h-[2.25rem]">
            {val || <span className="text-muted-foreground">—</span>}
          </div>
        )}
      </Field>
    );
  }

  function renderTextarea(field: keyof KarteFormValues, label: string, placeholder?: string) {
    const val = fv(field);
    const isEditable = canEdit(field);
    const orig = ofv(field);
    const isModified = isEditable && orig !== undefined && orig !== val;
    return (
      <Field>
        <FieldHeader field={field} label={label} />
        <OriginalValueHint field={field} />
        {isEditable ? (
          <Textarea
            value={val}
            onChange={(e) => set(field, e.target.value as never)}
            placeholder={placeholder}
            rows={4}
            required
            className={
              isModified
                ? "border-green-500"
                : editableFields?.has(field)
                  ? "border-destructive"
                  : undefined
            }
          />
        ) : (
          <div className="text-sm py-2.5 px-1 whitespace-pre-wrap">
            {val || <span className="text-muted-foreground">—</span>}
          </div>
        )}
      </Field>
    );
  }

  const clientTypeLabel = CLIENT_TYPES.find((ct) => ct.value === values.clientType)?.label ?? "";
  const resolutionLabel = values.resolutionType === "resolved" ? "解決" : "未解決";

  // --- Render ---

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <Section title="相談日時">
        <FieldHeader field="consultedAt" label="相談日時" />
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
        <FieldHeader field="clientType" label="相談者タイプ" />
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
          {renderField("clientName", "氏名", { placeholder: "例: 山田太郎", required: true })}
          {isStudent &&
            renderField("studentId", "学籍番号", { placeholder: "例: 12345678", required: true })}
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
                clearValue={() => set("liabilityConsent", false)}
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
                clearValue={() => set("disclosureConsent", false)}
              />
            </div>
          </Field>
        </div>
      </Section>

      <Section title="相談内容">
        <FieldHeader field="categoryIds" label="カテゴリ" />
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
          {renderField("targetDevice", "対象端末", {
            placeholder: "例: ノートPC (Windows)",
            required: true,
          })}
        </div>
        <div className="mt-4">
          {renderTextarea("troubleDetails", "トラブル詳細", "相談者が抱えている問題の詳細を記入")}
        </div>
      </Section>

      <Section title="対応記録">
        <FieldHeader field="assignedMemberIds" label="担当者" />
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

        {renderTextarea("supportContent", "対応内容", "実施した対応の詳細を記入")}

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Field>
            <FieldHeader field="resolutionType" label="解決ステータス" />
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
              <FieldHeader field="followUp" label="後処理" />
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

          {renderField("workDurationMinutes", "作業時間（分）", {
            type: "number",
            min: 0,
            placeholder: `経過 ${elapsedMinutes}分`,
            required: true,
          })}
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

// ============================================================================
// Small sub-components
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <Separator className="mb-4" />
      {children}
    </div>
  );
}

function AssigneeReadOnly({
  members,
  selectedIds,
  unresolvedNames,
}: {
  members: MemberOption[];
  selectedIds: Set<string>;
  unresolvedNames: string[];
}) {
  const resolvedMembers = members.filter((m) => selectedIds.has(m.id));
  const hasAny = resolvedMembers.length > 0 || unresolvedNames.length > 0;

  return (
    <div className="mb-4">
      <div className="mb-2">
        <FieldLabel>担当者</FieldLabel>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hasAny ? (
          <>
            {resolvedMembers.map((m) => (
              <HoverCard key={m.id}>
                <HoverCardTrigger>
                  <Badge variant="secondary" className="cursor-default">
                    {m.name}
                  </Badge>
                </HoverCardTrigger>
                <HoverCardContent>
                  <MemberHoverContent member={m} />
                </HoverCardContent>
              </HoverCard>
            ))}
            {unresolvedNames.map((name) => (
              <Badge key={name} variant="outline" className="text-muted-foreground">
                {name}
              </Badge>
            ))}
          </>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

function MemberHoverContent({ member }: { member: MemberOption }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-semibold">{member.name}</p>
      {member.studentId && (
        <div className="text-xs text-muted-foreground font-mono">{member.studentId}</div>
      )}
      {member.department && (
        <div className="text-xs text-muted-foreground">{member.department}</div>
      )}
      {member.email && <div className="text-xs text-muted-foreground">{member.email}</div>}
    </div>
  );
}
