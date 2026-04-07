import { clientTypeNames, UNIVERSITY_STRUCTURE } from "@shizuoka-its/core";
import type { ConsultedAtPrecision, MemberOption, CategoryOption } from "@/shared/api";

// ============================================================================
// Types
// ============================================================================

export type KarteFormValues = {
  consultedAtPrecision: ConsultedAtPrecision;
  consultedAt: string;
  clientType: "student" | "teacher" | "staff" | "other";
  clientName: string;
  studentId: string;
  courseType: "undergraduate" | "master" | "doctoral" | "professional";
  faculty: string;
  enrollmentType: string;
  program: string;
  department: string;
  major: string;
  course: string;
  subspecialty: string;
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

export type KarteFormProps = {
  members: MemberOption[];
  categories: CategoryOption[];
  initialValues?: Partial<KarteFormValues>;
  onSubmit?: (values: KarteFormValues) => Promise<void>;
  submitLabel?: string;
  readOnly?: boolean;
  editableFields?: Set<keyof KarteFormValues>;
  onFormChange?: (values: KarteFormValues) => void;
  unresolvedAssigneeNames?: string[];
  originalValues?: Partial<KarteFormValues>;
  onMarkNotRecorded?: (field: keyof KarteFormValues) => void;
};

// ============================================================================
// Constants
// ============================================================================

export const CLIENT_TYPES = (
  Object.entries(clientTypeNames) as [keyof typeof clientTypeNames, string][]
).map(([value, label]) => ({ value, label }));

export const COURSE_TYPES = Object.entries(UNIVERSITY_STRUCTURE).map(([value, { label }]) => ({
  value,
  label,
}));

export const PRECISION_OPTIONS: { value: ConsultedAtPrecision; label: string }[] = [
  { value: "datetime", label: "日時" },
  { value: "date", label: "日付のみ" },
  { value: "yearMonth", label: "年月のみ" },
  { value: "year", label: "年のみ" },
];

export const DEFAULTS: KarteFormValues = {
  consultedAtPrecision: "datetime",
  consultedAt: "",
  clientType: "student",
  clientName: "",
  studentId: "",
  courseType: "undergraduate",
  faculty: "",
  enrollmentType: "",
  program: "",
  department: "",
  major: "",
  course: "",
  subspecialty: "",
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
// Pure helpers
// ============================================================================

export function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function canEdit(
  field: keyof KarteFormValues,
  readOnly: boolean,
  editableFields?: Set<keyof KarteFormValues>,
): boolean {
  if (readOnly) return false;
  if (editableFields) return editableFields.has(field);
  return true;
}

export function fieldValue(values: KarteFormValues, field: keyof KarteFormValues): string {
  const raw = values[field];
  return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
}

export function originalFieldValue(
  originalValues: Partial<KarteFormValues> | undefined,
  field: keyof KarteFormValues,
): string | undefined {
  if (!originalValues) return undefined;
  const raw = originalValues[field];
  if (raw === undefined) return undefined;
  return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
}

export function createInitialValues(initialValues?: Partial<KarteFormValues>): KarteFormValues {
  return {
    ...DEFAULTS,
    consultedAt: toLocalDatetimeString(new Date()),
    ...initialValues,
    categoryIds: new Set(initialValues?.categoryIds ?? []),
    assignedMemberIds: new Set(initialValues?.assignedMemberIds ?? []),
  };
}
