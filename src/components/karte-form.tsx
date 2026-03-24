"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getFaculties, getDepartments, getMaxYear } from "@shizuoka-its/core";
import { LoaderIcon, SaveIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type ConsultedAtPrecision = "datetime" | "date" | "yearMonth" | "year";

export type KarteFormValues = {
  consultedAtPrecision: ConsultedAtPrecision;
  consultedAt: string;
  clientType: "student" | "teacher" | "staff" | "other";
  clientName: string;
  studentId: string;
  courseType: "undergraduate" | "master" | "doctoral" | "professional";
  faculty: string;
  department: string;
  year: string;
  liabilityConsent: boolean;
  disclosureConsent: boolean;
  categoryIds: Set<string>;
  targetDevice: string;
  troubleDetails: string;
  assignedMemberIds: Set<string>;
  supportContent: string;
  resolutionType: "resolved" | "unresolved";
  followUp: string;
  workDurationMinutes: string;
};

export type MemberOption = {
  id: string;
  name: string;
  studentId?: string;
  department?: string;
  email?: string;
};
export type CategoryOption = { id: string; displayName: string };

type KarteFormProps = {
  members: MemberOption[];
  categories: CategoryOption[];
  initialValues?: Partial<KarteFormValues>;
  onSubmit?: (values: KarteFormValues) => Promise<void>;
  submitLabel?: string;
  /** 全フィールド読み取り専用 */
  readOnly?: boolean;
  /** 指定されたフィールドのみ編集可能（他は読み取り専用） */
  editableFields?: Set<keyof KarteFormValues>;
  /** フォーム値が変更されるたびに呼ばれるコールバック */
  onFormChange?: (values: KarteFormValues) => void;
  /** readOnly時のみ: IDに紐づかない対応者名のリスト */
  unresolvedAssigneeNames?: string[];
  /** editableFields使用時: 修正前の値（差分表示用） */
  originalValues?: Partial<KarteFormValues>;
  /** editableFields使用時: フィールドを「未記録」としてマークするコールバック */
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
};

const CLIENT_TYPES = [
  { value: "student", label: "学生" },
  { value: "teacher", label: "教員" },
  { value: "staff", label: "職員" },
  { value: "other", label: "その他" },
] as const;

const COURSE_TYPES = [
  { value: "undergraduate", label: "学部" },
  { value: "master", label: "修士" },
  { value: "doctoral", label: "博士" },
  { value: "professional", label: "専門職" },
] as const;

const FOLLOW_UPS = ["技術部", "生協", "情報基盤センター", "見送り", "その他"];

const PRECISION_OPTIONS: { value: ConsultedAtPrecision; label: string }[] = [
  { value: "datetime", label: "日時" },
  { value: "date", label: "日付のみ" },
  { value: "yearMonth", label: "年月のみ" },
  { value: "year", label: "年のみ" },
];

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 精度に応じた表示用フォーマット */
export function formatConsultedAtDisplay(precision: ConsultedAtPrecision, value: string): string {
  if (!value) return "—";
  switch (precision) {
    case "year":
      return `${value}年`;
    case "yearMonth": {
      const [y, m] = value.split("-");
      return `${y}年${Number(m)}月`;
    }
    case "date":
      return new Date(`${value}T00:00:00`).toLocaleDateString("ja-JP");
    case "datetime":
      return new Date(value).toLocaleString("ja-JP");
  }
}

/** 精度に応じた入力フィールド */
function ConsultedAtInput({
  precision,
  value,
  onChange,
  className,
}: {
  precision: ConsultedAtPrecision;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  switch (precision) {
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "yearMonth":
      return (
        <Input
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
    case "year":
      return (
        <Input
          type="number"
          min={2000}
          max={2099}
          placeholder="例: 2025"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      );
  }
}

const DEFAULTS: KarteFormValues = {
  consultedAtPrecision: "datetime",
  consultedAt: "",
  clientType: "student",
  clientName: "",
  studentId: "",
  courseType: "undergraduate",
  faculty: "",
  department: "",
  year: "",
  liabilityConsent: false,
  disclosureConsent: false,
  categoryIds: new Set(),
  targetDevice: "",
  troubleDetails: "",
  assignedMemberIds: new Set(),
  supportContent: "",
  resolutionType: "resolved",
  followUp: "",
  workDurationMinutes: "",
};

// ============================================================================
// Component
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
  const [values, setValues] = useState<KarteFormValues>(() => ({
    ...DEFAULTS,
    consultedAt: toLocalDatetimeString(new Date()),
    ...initialValues,
    categoryIds: new Set(initialValues?.categoryIds ?? []),
    assignedMemberIds: new Set(initialValues?.assignedMemberIds ?? []),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  /** フィールドが編集可能かどうか */
  function canEdit(field: keyof KarteFormValues): boolean {
    if (readOnly) return false;
    if (editableFields) return editableFields.has(field);
    return true;
  }

  useEffect(() => {
    if (!editableFields || editableFields.size === 0) return;
    const first = [...editableFields][0];
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount only

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

  const isStudent = values.clientType === "student";
  const hasSubmit = !readOnly && onSubmit;

  /** フィールドが編集可能なら Input、そうでなければテキスト表示 */
  function fieldValue(field: keyof KarteFormValues): string {
    const raw = values[field];
    return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  }

  function originalFieldValue(field: keyof KarteFormValues): string | undefined {
    if (!originalValues) return undefined;
    const raw = originalValues[field];
    if (raw === undefined) return undefined;
    return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  }

  function OriginalValueHint({ field }: { field: keyof KarteFormValues }) {
    if (!editableFields?.has(field)) return null;
    const orig = originalFieldValue(field);
    if (orig === undefined) return null;
    return (
      <div className="text-xs text-muted-foreground mb-1">
        修正前: <span className="font-mono">{orig || "（空）"}</span>
      </div>
    );
  }

  /** 「未記録にする」ピル型ボタン（フィールドがeditable時のみ表示） */
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
          if (clearValue) {
            clearValue();
          } else {
            set(field, "" as never);
          }
          onMarkNotRecorded(field);
        }}
      >
        未記録にする
      </button>
    );
  }

  /** FieldLabel + NotRecordedPill をまとめたヘッダー行 */
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
    opts?: {
      type?: string;
      placeholder?: string;
      required?: boolean;
      min?: number;
      max?: number;
    },
  ) {
    const val = fieldValue(field);
    const isEditable = canEdit(field);
    const orig = originalFieldValue(field);
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
    const val = fieldValue(field);
    const isEditable = canEdit(field);
    const orig = originalFieldValue(field);
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* 相談日時 */}
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

      {/* 相談者情報 */}
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

      {/* 同意事項 */}
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

      {/* 相談内容 */}
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

      {/* 対応記録 */}
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
                <Select
                  value={values.followUp}
                  onValueChange={(v) => {
                    if (v) set("followUp", v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLLOW_UPS.map((fu) => (
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

      {/* Submit */}
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <Separator className="mb-4" />
      {children}
    </div>
  );
}

type MultiSelectItem = {
  id: string;
  label: string;
  searchText: string;
  /** ホバー時に表示する追加情報 */
  hoverDetail?: React.ReactNode;
};

function SearchableMultiSelect({
  label,
  items,
  selected,
  onToggle,
  placeholder,
  readOnly = false,
  extraReadOnlyLabels = [],
}: {
  label: string;
  items: MultiSelectItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  placeholder: string;
  readOnly?: boolean;
  extraReadOnlyLabels?: string[];
}) {
  const [query, setQuery] = useState("");
  const lowerQuery = query.toLowerCase();
  const filtered = lowerQuery
    ? items.filter((item) => item.searchText.toLowerCase().includes(lowerQuery))
    : items;

  const selectedItems = items.filter((item) => selected.has(item.id));

  if (readOnly) {
    const hasAny = selectedItems.length > 0 || extraReadOnlyLabels.length > 0;
    return (
      <div className="mb-4">
        <div className="mb-2">
          <FieldLabel>{label}</FieldLabel>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {hasAny ? (
            <>
              {selectedItems.map((item) => (
                <Badge key={item.id} variant="secondary">
                  {item.label}
                </Badge>
              ))}
              {extraReadOnlyLabels.map((name) => (
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

  return (
    <div className="mb-4">
      {label && (
        <div className="mb-2">
          <FieldLabel>{label}</FieldLabel>
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedItems.map((item) => {
            const badge = (
              <Badge
                key={item.id}
                variant="default"
                className="cursor-pointer select-none"
                onClick={() => onToggle(item.id)}
              >
                {item.label} ×
              </Badge>
            );
            if (!item.hoverDetail) return badge;
            return (
              <HoverCard key={item.id}>
                <HoverCardTrigger>{badge}</HoverCardTrigger>
                <HoverCardContent>{item.hoverDetail}</HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="mb-2"
      />

      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {filtered.map((item) => {
          const isSelected = selected.has(item.id);
          const badge = (
            <Badge
              key={item.id}
              variant={isSelected ? "secondary" : "outline"}
              className={cn(
                "cursor-pointer select-none transition-colors",
                isSelected && "opacity-50",
              )}
              onClick={() => onToggle(item.id)}
            >
              {item.label}
            </Badge>
          );
          if (!item.hoverDetail) return badge;
          return (
            <HoverCard key={item.id}>
              <HoverCardTrigger>{badge}</HoverCardTrigger>
              <HoverCardContent>{item.hoverDetail}</HoverCardContent>
            </HoverCard>
          );
        })}
        {filtered.length === 0 && (
          <span className="text-sm text-muted-foreground">一致する項目がありません</span>
        )}
      </div>
    </div>
  );
}

function AffiliationFields({
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
  const faculties = getFaculties(values.courseType);
  const departments = getDepartments(values.courseType, values.faculty);
  const maxYear = getMaxYear(values.courseType);

  const editable = canEdit("courseType");

  const affiliationPill =
    onMarkNotRecorded && editableFields?.has("faculty") ? (
      <button
        type="button"
        className="rounded-full border border-dashed border-muted-foreground/50 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        onClick={() => {
          set("courseType", "" as never);
          set("faculty", "" as never);
          set("department", "" as never);
          set("year", "" as never);
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
      values.faculty,
      values.department,
      values.year ? `${values.year}年` : "",
    ].filter(Boolean);
    return (
      <div className="mt-4">
        <FieldLabel>所属</FieldLabel>
        <div className="text-sm py-2.5 px-1">{parts.join(" / ") || "—"}</div>
      </div>
    );
  }

  function selectCourseType(ct: string) {
    set("courseType", ct as never);
    const nextFaculties = getFaculties(ct);
    if (nextFaculties.length === 1) {
      selectFacultyWithCourse(ct, nextFaculties[0].name);
    } else {
      set("faculty", "" as never);
      set("department", "" as never);
      set("year", "" as never);
    }
  }

  function selectFacultyWithCourse(ct: string, f: string) {
    set("faculty", f as never);
    const nextDepts = getDepartments(ct, f);
    if (nextDepts.length === 1) {
      set("department", nextDepts[0] as never);
    } else {
      set("department", "" as never);
    }
    const maxY = getMaxYear(ct);
    if (maxY === 1) {
      set("year", "1" as never);
    } else {
      set("year", "" as never);
    }
  }

  function selectFaculty(f: string) {
    selectFacultyWithCourse(values.courseType, f);
  }

  function selectDepartment(d: string) {
    set("department", d as never);
    if (maxYear === 1) {
      set("year", "1" as never);
    } else {
      set("year", "" as never);
    }
  }

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
      {/* 課程 */}
      <AffiliationStep label="課程">
        {COURSE_TYPES.map((ct) => (
          <Button
            key={ct.value}
            type="button"
            size="sm"
            variant={values.courseType === ct.value ? "default" : "outline"}
            onClick={() => selectCourseType(ct.value)}
          >
            {ct.label}
          </Button>
        ))}
      </AffiliationStep>

      {/* 学部・研究科 */}
      {values.courseType && faculties.length > 0 && (
        <AffiliationStep label="学部・研究科">
          {faculties.map((f) => (
            <Button
              key={f.name}
              type="button"
              size="sm"
              variant={values.faculty === f.name ? "default" : "outline"}
              onClick={() => selectFaculty(f.name)}
            >
              {f.name}
            </Button>
          ))}
        </AffiliationStep>
      )}

      {/* 学科・専攻 */}
      {values.faculty && departments.length > 0 && (
        <AffiliationStep label="学科・専攻">
          {departments.map((d) => (
            <Button
              key={d}
              type="button"
              size="sm"
              variant={values.department === d ? "default" : "outline"}
              onClick={() => selectDepartment(d)}
            >
              {d}
            </Button>
          ))}
        </AffiliationStep>
      )}

      {/* 学年 */}
      {values.faculty && (
        <AffiliationStep label="学年">
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
        </AffiliationStep>
      )}
    </div>
  );
}

function AffiliationStep({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
