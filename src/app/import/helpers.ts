import type { CsvRow } from "@/lib/parseCsv";
import type { KarteTableRow } from "@/components/karte-table";
import type { KarteFormValues } from "@/components/karte-form";
import type { ComparisonRow } from "@/components/duplicate-comparison";
import type { ConsultationCategoryId } from "@shizuoka-its/core";
import type { listKartesWithMembers } from "@/actions/karte";

// ============================================================================
// Types
// ============================================================================

export type MemberInfo = {
  id: string;
  name: string;
  studentId: string;
  department: string;
  email: string;
};
export type ExistingKarte = Awaited<ReturnType<typeof listKartesWithMembers>>[number];

export type DuplicateMatch = {
  existingKarte: ExistingKarte;
  matchedFields: ("nameDate" | "trouble" | "support")[];
};

type Fingerprints = {
  nameDate: string;
  trouble: string;
  support: string;
};

// ============================================================================
// Constants & Helpers
// ============================================================================

const TAG_MAPPING: Record<string, ConsultationCategoryId> = {
  wifi_eduroam: "wifi_eduroam",
  wifi_succes: "wifi_success",
  wifi_success: "wifi_success",
  wifi_smartphone: "wifi_smartphone",
  usage_mac: "usage_mac",
  usage_fs: "usage_fs",
  usage_vpn: "usage_vpn",
  usage_mail: "usage_mail",
  usage_gakujo: "usage_gakujo",
  usage_onedrive: "usage_onedrive",
  usage_printer: "usage_printer",
  usage_vm: "usage_vm",
  usage_ms_software: "usage_ms_software",
  hardware_pc: "hardware_pc",
  problem_credential: "problem_credential",
  problem_os: "problem_windows",
  problem_windows: "problem_windows",
  problem_linux: "problem_linux",
  programming: "programming",
  rent: "rent",
  other: "other",
};

export function parseGradeType(grade: string): "student" | "staff" | "teacher" | "other" {
  if (grade === "職員") return "staff";
  if (grade === "教員") return "teacher";
  if (grade === "その他") return "other";
  return "student";
}

export function formatCsvAffiliation(row: CsvRow): string {
  const m = row.grade.match(/^(学部|修士|博士)\s*(\d+)年$/);
  if (!m) return row.grade;
  return `${row.faculty} ${row.department} ${m[1] === "学部" ? "" : m[1]}${m[2]}年`.trim();
}

export function parseCategoryTags(tags: string) {
  return tags
    .split(", ")
    .map((tag) => {
      const mappedId = TAG_MAPPING[tag.split(" ")[0]];
      return mappedId ? { id: mappedId, displayName: tag } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

// ============================================================================
// Fingerprinting
// ============================================================================

function buildFingerprints(
  name: string,
  date: string,
  trouble: string,
  support: string,
): Fingerprints {
  return {
    nameDate: `${name.trim()}|${date.trim()}`,
    trouble: trouble.trim().slice(0, 100),
    support: support.trim().slice(0, 100),
  };
}

export function fingerprintsFromCsvRow(row: CsvRow): Fingerprints {
  return buildFingerprints(
    row.name,
    row.date || row.timestamp,
    row.troubleDetails,
    row.supportContent,
  );
}

export function fingerprintsFromKarte(k: ExistingKarte): Fingerprints {
  const name = k.client.type === "recorded" ? k.client.value.name : "";
  const date = k.consultedAt.type === "recorded" ? k.consultedAt.value : k.recordedAt;
  return buildFingerprints(name, date, k.consultation.troubleDetails, k.supportRecord.content);
}

export function findDuplicateMatches(
  row: CsvRow,
  existingKartes: ExistingKarte[],
  karteFingerprints: Fingerprints[],
): DuplicateMatch[] {
  const fp = fingerprintsFromCsvRow(row);
  const matchMap = new Map<number, Set<"nameDate" | "trouble" | "support">>();

  for (let i = 0; i < karteFingerprints.length; i++) {
    const kfp = karteFingerprints[i];
    const fields = new Set<"nameDate" | "trouble" | "support">();
    if (fp.nameDate && kfp.nameDate === fp.nameDate) fields.add("nameDate");
    if (fp.trouble && kfp.trouble === fp.trouble) fields.add("trouble");
    if (fp.support && kfp.support === fp.support) fields.add("support");
    if (fields.size > 0) matchMap.set(i, fields);
  }

  return [...matchMap.entries()].map(([idx, fields]) => ({
    existingKarte: existingKartes[idx],
    matchedFields: [...fields],
  }));
}

// ============================================================================
// Batch Duplicate Detection
// ============================================================================

export function findBatchDuplicates(rows: CsvRow[]): Set<number> {
  const seen = new Map<string, number>();
  const dupes = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const fp = fingerprintsFromCsvRow(rows[i]);
    for (const key of [fp.nameDate, fp.trouble, fp.support]) {
      if (!key) continue;
      const prev = seen.get(key);
      if (prev !== undefined) {
        dupes.add(prev);
        dupes.add(i);
      } else seen.set(key, i);
    }
  }
  return dupes;
}

// ============================================================================
// Validation
// ============================================================================

export function validateRow(
  row: CsvRow,
  _index: number,
  memberMapping: Map<string, string>,
): string | undefined {
  const errors: string[] = [];

  if (!row.timestamp) errors.push("タイムスタンプが空");
  // 新形式では名前がない場合がある（学籍番号で代用）ため、名前と学籍番号の少なくとも一つが必須
  if (!row.name && !row.studentId) errors.push("氏名または学籍番号が空");
  if (!row.troubleDetails) errors.push("トラブル詳細が空");
  if (!row.supportContent) errors.push("対応内容が空");

  const gradeType = parseGradeType(row.grade);
  if (gradeType === "student") {
    if (!row.studentId) errors.push("学籍番号が空");
    else if (!/^[0-9]{8}$|^[0-9]{3}[A-Z][0-9]{4}$/.test(row.studentId)) {
      errors.push(`学籍番号が不正: ${row.studentId}`);
    }
  }

  const assigneeIds = row.assignee
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const unmapped = assigneeIds.filter((id) => !memberMapping.has(id));
  if (unmapped.length > 0) errors.push(`担当者未解決: ${unmapped.join(", ")}`);

  if (row.workDuration && Number.isNaN(Number(row.workDuration))) {
    errors.push(`作業時間が数値でない: ${row.workDuration}`);
  }

  return errors.length > 0 ? errors.join(" / ") : undefined;
}

/** エラーのあるCsvRowフィールド名のセットを返す */
export function getErrorFields(row: CsvRow, memberMapping: Map<string, string>): Set<keyof CsvRow> {
  const fields = new Set<keyof CsvRow>();

  if (!row.timestamp) fields.add("timestamp");
  // 新形式では名前がない場合がある（学籍番号で代用）ため、両方空の場合のみエラー
  if (!row.name && !row.studentId) {
    fields.add("name");
    fields.add("studentId");
  }
  if (!row.troubleDetails) fields.add("troubleDetails");
  if (!row.supportContent) fields.add("supportContent");

  const gradeType = parseGradeType(row.grade);
  if (gradeType === "student") {
    if (!row.studentId || !/^[0-9]{8}$|^[0-9]{3}[A-Z][0-9]{4}$/.test(row.studentId)) {
      fields.add("studentId");
    }
  }

  const assigneeIds = row.assignee
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (assigneeIds.some((id) => !memberMapping.has(id))) {
    fields.add("assignee");
  }

  if (row.workDuration && Number.isNaN(Number(row.workDuration))) {
    fields.add("workDuration");
  }

  return fields;
}

// ============================================================================
// CSV Row → Table Row
// ============================================================================

export function csvRowToTableRow(
  row: CsvRow,
  index: number,
  memberMapping: Map<string, string>,
  members: MemberInfo[],
): KarteTableRow {
  const categories = parseCategoryTags(row.categoryTags);
  const gradeType = parseGradeType(row.grade);
  const assigneeIds = row.assignee
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const assigneeNames = assigneeIds.map((id) => {
    const memberId = memberMapping.get(id);
    if (!memberId) return `⚠ ${id}`;
    return members.find((m) => m.id === memberId)?.name ?? id;
  });

  return {
    id: String(index),
    recordedAt: row.timestamp
      ? new Date(row.timestamp.replace(/\//g, "-")).toISOString()
      : new Date().toISOString(),
    consultedAt: row.date
      ? { type: "recorded", value: new Date(row.date.replace(/\//g, "-")).toISOString() }
      : { type: "notRecorded" },
    client: row.name
      ? {
          type: "recorded",
          value: {
            type:
              gradeType === "student"
                ? "学生"
                : gradeType === "teacher"
                  ? "教員"
                  : gradeType === "staff"
                    ? "職員"
                    : "その他",
            name: row.name,
            studentId: gradeType === "student" ? row.studentId : undefined,
            affiliation:
              gradeType === "student" ? `学生 / ${formatCsvAffiliation(row)}` : undefined,
          },
        }
      : { type: "notRecorded" },
    consent: {
      liabilityConsent: row.liabilityConsent === "同意する" || row.liabilityConsent === "同意あり",
      disclosureConsent:
        row.disclosureConsent === "同意する" || row.disclosureConsent === "同意あり",
    },
    consultation: {
      targetDevice: row.targetDevice
        ? { type: "recorded", value: row.targetDevice }
        : { type: "notRecorded" },
      categories:
        categories.length > 0 ? { type: "recorded", value: categories } : { type: "notRecorded" },
      troubleDetails: row.troubleDetails,
    },
    assignedMemberNames: assigneeNames,
    supportRecord: {
      content: row.supportContent,
      resolution: row.resolution
        ? {
            type: "recorded",
            value:
              row.resolution === "解決"
                ? { type: "resolved" as const }
                : { type: "unresolved" as const, followUp: row.followUp || undefined },
          }
        : { type: "notRecorded" },
      workDuration: row.workDuration
        ? { type: "recorded", value: Number(row.workDuration) }
        : { type: "notRecorded" },
    },
    error: validateRow(row, index, memberMapping),
  };
}

// ============================================================================
// Comparison Builder
// ============================================================================

export function buildComparisonFields(
  csvRow: CsvRow,
  karte: ExistingKarte,
  matchedFields: string[],
): ComparisonRow[] {
  const isMatch = (key: string) => matchedFields.includes(key);
  const dbClient = karte.client.type === "recorded" ? karte.client.value : null;
  const dbDate =
    karte.consultedAt.type === "recorded"
      ? new Date(karte.consultedAt.value).toLocaleString("ja-JP")
      : "";
  const dbDevice =
    karte.consultation.targetDevice.type === "recorded"
      ? karte.consultation.targetDevice.value
      : "";
  const dbCategories =
    karte.consultation.categories.type === "recorded"
      ? karte.consultation.categories.value.map((c) => c.displayName).join(", ")
      : "";
  const dbResolution =
    karte.supportRecord.resolution.type === "recorded"
      ? karte.supportRecord.resolution.value.type === "resolved"
        ? "解決"
        : "未解決"
      : "";
  const dbDuration =
    karte.supportRecord.workDuration.type === "recorded"
      ? `${karte.supportRecord.workDuration.value}分`
      : "";

  return [
    {
      label: "氏名",
      csvValue: csvRow.name,
      dbValue: dbClient?.name ?? "",
      isMatchKey: isMatch("nameDate"),
    },
    { label: "相談日", csvValue: csvRow.date, dbValue: dbDate, isMatchKey: isMatch("nameDate") },
    {
      label: "学籍番号",
      csvValue: csvRow.studentId,
      dbValue: dbClient?.studentId ?? "",
      isMatchKey: false,
    },
    {
      label: "所属",
      csvValue: formatCsvAffiliation(csvRow),
      dbValue: dbClient?.affiliation ?? "",
      isMatchKey: false,
    },
    { label: "対象端末", csvValue: csvRow.targetDevice, dbValue: dbDevice, isMatchKey: false },
    { label: "カテゴリ", csvValue: csvRow.categoryTags, dbValue: dbCategories, isMatchKey: false },
    {
      label: "トラブル詳細",
      csvValue: csvRow.troubleDetails,
      dbValue: karte.consultation.troubleDetails,
      isMatchKey: isMatch("trouble"),
    },
    {
      label: "対応内容",
      csvValue: csvRow.supportContent,
      dbValue: karte.supportRecord.content,
      isMatchKey: isMatch("support"),
    },
    {
      label: "担当者",
      csvValue: csvRow.assignee,
      dbValue: karte.assignedMemberNames.join(", "),
      isMatchKey: false,
    },
    { label: "解決", csvValue: csvRow.resolution, dbValue: dbResolution, isMatchKey: false },
    {
      label: "作業時間",
      csvValue: csvRow.workDuration ? `${csvRow.workDuration}分` : "",
      dbValue: dbDuration,
      isMatchKey: false,
    },
  ];
}

// ============================================================================
// CsvRow ↔ KarteFormValues Conversion
// ============================================================================

/** CsvRowエラーフィールド → KarteFormValuesフィールドのマッピング */
const CSV_TO_FORM_FIELD: Partial<Record<keyof CsvRow, (keyof KarteFormValues)[]>> = {
  timestamp: ["consultedAt"],
  name: ["clientName"],
  studentId: ["studentId"],
  faculty: ["faculty"],
  department: ["department"],
  grade: ["courseType", "year"],
  troubleDetails: ["troubleDetails"],
  supportContent: ["supportContent"],
  assignee: ["assignedMemberIds"],
  workDuration: ["workDurationMinutes"],
  targetDevice: ["targetDevice"],
};

export function csvErrorFieldsToEditableFields(
  csvFields: Set<keyof CsvRow>,
): Set<keyof KarteFormValues> {
  const formFields = new Set<keyof KarteFormValues>();
  for (const csvField of csvFields) {
    const mapped = CSV_TO_FORM_FIELD[csvField];
    if (mapped) for (const f of mapped) formFields.add(f);
  }
  return formFields;
}

export function csvRowToFormValues(
  row: CsvRow,
  memberMapping: Map<string, string>,
): Partial<KarteFormValues> {
  const gradeType = parseGradeType(row.grade);
  const gradeMatch = row.grade.match(/^(学部|修士|博士|専門職)\s*(\d+)年$/);
  const courseType =
    gradeMatch?.[1] === "修士"
      ? "master"
      : gradeMatch?.[1] === "博士"
        ? "doctoral"
        : gradeMatch?.[1] === "専門職"
          ? "professional"
          : "undergraduate";

  const assigneeIds = row.assignee
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => memberMapping.get(id))
    .filter((id): id is string => id !== undefined);

  const categories = parseCategoryTags(row.categoryTags);

  return {
    consultedAt: row.date
      ? new Date(row.date.replace(/\//g, "-")).toISOString().slice(0, 16)
      : row.timestamp
        ? new Date(row.timestamp.replace(/\//g, "-")).toISOString().slice(0, 16)
        : "",
    clientType: gradeType as KarteFormValues["clientType"],
    clientName: row.name,
    studentId: row.studentId,
    courseType,
    faculty: row.faculty,
    department: row.department,
    year: gradeMatch?.[2] ?? "",
    liabilityConsent: row.liabilityConsent === "同意する" || row.liabilityConsent === "同意あり",
    disclosureConsent: row.disclosureConsent === "同意する" || row.disclosureConsent === "同意あり",
    categoryIds: new Set(categories.map((c) => c.id)),
    targetDevice: row.targetDevice,
    troubleDetails: row.troubleDetails,
    assignedMemberIds: new Set(assigneeIds),
    supportContent: row.supportContent,
    resolutionType: row.resolution === "解決" ? "resolved" : "unresolved",
    followUp: row.followUp,
    workDurationMinutes: row.workDuration || "",
  };
}

export function formValuesToCsvRow(
  formValues: KarteFormValues,
  originalRow: CsvRow,
  members: MemberInfo[],
): CsvRow {
  const courseLabels: Record<string, string> = {
    undergraduate: "学部",
    master: "修士",
    doctoral: "博士",
    professional: "専門職",
  };
  const gradeStr = formValues.year
    ? `${courseLabels[formValues.courseType] ?? "学部"}${formValues.year}年`
    : originalRow.grade;

  const assigneeNames = [...formValues.assignedMemberIds]
    .map((mid) => {
      const member = members.find((m) => m.id === mid);
      return member?.studentId ?? member?.name ?? mid;
    })
    .join(", ");

  return {
    ...originalRow,
    date: formValues.consultedAt
      ? new Date(formValues.consultedAt).toLocaleDateString("ja-JP")
      : originalRow.date,
    name: formValues.clientName,
    studentId: formValues.studentId,
    faculty: formValues.faculty,
    department: formValues.department,
    grade: gradeStr,
    targetDevice: formValues.targetDevice,
    troubleDetails: formValues.troubleDetails,
    supportContent: formValues.supportContent,
    assignee: assigneeNames || originalRow.assignee,
    workDuration: formValues.workDurationMinutes,
    resolution: formValues.resolutionType === "resolved" ? "解決" : "未解決",
    followUp: formValues.followUp,
  };
}

// ============================================================================
// CSV Export
// ============================================================================

export function exportErrorCsv(rows: CsvRow[], errorRows: Set<number>) {
  const header = [
    "タイムスタンプ",
    "日付",
    "学籍番号",
    "氏名",
    "学部",
    "学科",
    "学年",
    "情報公開同意",
    "免責同意",
    "対象端末",
    "属性タグ",
    "トラブル詳細",
    "対応内容",
    "解決",
    "後処理",
    "担当者",
    "作業時間",
  ];
  const escape = (s: string) =>
    s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  const csvRows = [header.join(",")];
  for (const idx of errorRows) {
    const r = rows[idx];
    csvRows.push(
      [
        r.timestamp,
        r.date,
        r.studentId,
        r.name,
        r.faculty,
        r.department,
        r.grade,
        r.disclosureConsent,
        r.liabilityConsent,
        r.targetDevice,
        r.categoryTags,
        r.troubleDetails,
        r.supportContent,
        r.resolution,
        r.followUp,
        r.assignee,
        r.workDuration,
      ]
        .map(escape)
        .join(","),
    );
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}
