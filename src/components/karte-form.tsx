"use client";

import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getFaculties, getDepartments, getMaxYear } from "@/lib/universityStructure";
import { LoaderIcon, SaveIcon } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type KarteFormValues = {
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

export type MemberOption = { id: string; name: string; studentId?: string };
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

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEFAULTS: KarteFormValues = {
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
    function update() {
      if (!values.consultedAt) return;
      const diff = Date.now() - new Date(values.consultedAt).getTime();
      setElapsedMinutes(Math.max(0, Math.round(diff / 60000)));
    }
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [values.consultedAt]);

  function set<K extends keyof KarteFormValues>(key: K, value: KarteFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function toggleInSet(key: "categoryIds" | "assignedMemberIds", id: string) {
    setValues((prev) => {
      const next = new Set(prev[key]);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [key]: next };
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
    return (
      <Field>
        <FieldLabel>{label}</FieldLabel>
        {canEdit(field) ? (
          <Input
            type={opts?.type}
            min={opts?.min}
            max={opts?.max}
            value={val}
            onChange={(e) => set(field, e.target.value as never)}
            placeholder={opts?.placeholder}
            required={opts?.required}
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
    return (
      <Field>
        <FieldLabel>{label}</FieldLabel>
        {canEdit(field) ? (
          <Textarea
            value={val}
            onChange={(e) => set(field, e.target.value as never)}
            placeholder={placeholder}
            rows={4}
            required
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
        <Field className="max-w-xs">
          <FieldLabel>相談日時</FieldLabel>
          {canEdit("consultedAt") ? (
            <Input
              type="datetime-local"
              value={values.consultedAt}
              onChange={(e) => set("consultedAt", e.target.value)}
              required
            />
          ) : (
            <div className="text-sm py-2.5 px-1">
              {values.consultedAt ? new Date(values.consultedAt).toLocaleString("ja-JP") : "—"}
            </div>
          )}
        </Field>
      </Section>

      {/* 相談者情報 */}
      <Section title="相談者情報">
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

        {isStudent && <AffiliationFields values={values} canEdit={canEdit} set={set} />}
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
            </div>
          </Field>
        </div>
      </Section>

      {/* 相談内容 */}
      <Section title="相談内容">
        <SearchableMultiSelect
          label="カテゴリ"
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
        <SearchableMultiSelect
          label="担当者"
          items={members.map((m) => ({
            id: m.id,
            label: m.name,
            searchText: `${m.name} ${m.studentId ?? ""}`,
          }))}
          selected={values.assignedMemberIds}
          onToggle={(id) => toggleInSet("assignedMemberIds", id)}
          placeholder="名前・学籍番号で検索..."
          readOnly={!canEdit("assignedMemberIds")}
        />

        {renderTextarea("supportContent", "対応内容", "実施した対応の詳細を記入")}

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Field>
            <FieldLabel>解決ステータス</FieldLabel>
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
              <FieldLabel>後処理</FieldLabel>
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

type MultiSelectItem = { id: string; label: string; searchText: string };

function SearchableMultiSelect({
  label,
  items,
  selected,
  onToggle,
  placeholder,
  readOnly = false,
}: {
  label: string;
  items: MultiSelectItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  placeholder: string;
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const lowerQuery = query.toLowerCase();
  const filtered = lowerQuery
    ? items.filter((item) => item.searchText.toLowerCase().includes(lowerQuery))
    : items;

  const selectedItems = items.filter((item) => selected.has(item.id));

  if (readOnly) {
    return (
      <div className="mb-4">
        <div className="mb-2">
          <FieldLabel>{label}</FieldLabel>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {selectedItems.length > 0 ? (
            selectedItems.map((item) => (
              <Badge key={item.id} variant="secondary">
                {item.label}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="mb-2">
        <FieldLabel>{label}</FieldLabel>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedItems.map((item) => (
            <Badge
              key={item.id}
              variant="default"
              className="cursor-pointer select-none"
              onClick={() => onToggle(item.id)}
            >
              {item.label} ×
            </Badge>
          ))}
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
          return (
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
}: {
  values: KarteFormValues;
  canEdit: (field: keyof KarteFormValues) => boolean;
  set: <K extends keyof KarteFormValues>(key: K, value: KarteFormValues[K]) => void;
}) {
  const faculties = getFaculties(values.courseType);
  const departments = getDepartments(values.courseType, values.faculty);
  const maxYear = getMaxYear(values.courseType);

  function renderSelect(
    field: keyof KarteFormValues,
    label: string,
    options: { value: string; label: string }[],
    placeholder: string,
    displayValue?: string,
  ) {
    const raw = values[field];
    const val = typeof raw === "string" ? raw : "";
    const display = displayValue ?? options.find((o) => o.value === val)?.label ?? val;
    if (!canEdit(field)) {
      return (
        <Field>
          <FieldLabel>{label}</FieldLabel>
          <div className="text-sm py-2.5 px-1">{display || "—"}</div>
        </Field>
      );
    }
    return (
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <Select
          value={val}
          onValueChange={(v) => {
            if (v) set(field, v as never);
          }}
        >
          <SelectTrigger>
            <SelectValue>{display || placeholder}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4 mt-4">
      {renderSelect(
        "courseType",
        "課程",
        COURSE_TYPES.map((ct) => ({ value: ct.value, label: ct.label })),
        "選択",
      )}
      {renderSelect(
        "faculty",
        "学部・研究科",
        faculties.map((f) => ({ value: f.name, label: f.name })),
        "選択",
        values.faculty || undefined,
      )}
      {departments.length > 0 ? (
        renderSelect(
          "department",
          "学科・専攻",
          departments.map((d) => ({ value: d, label: d })),
          "選択",
          values.department || undefined,
        )
      ) : (
        <Field>
          <FieldLabel>学科・専攻</FieldLabel>
          <div className="text-sm py-2.5 px-1 text-muted-foreground">—</div>
        </Field>
      )}
      {renderSelect(
        "year",
        "学年",
        Array.from({ length: maxYear }, (_, i) => ({ value: String(i + 1), label: `${i + 1}年` })),
        "選択",
        values.year ? `${values.year}年` : undefined,
      )}
    </div>
  );
}
