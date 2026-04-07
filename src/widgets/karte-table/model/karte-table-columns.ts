import type { ConsultedAtPrecision } from "@/shared/api";

// ============================================================================
// Types
// ============================================================================

type Recorded<T> = { type: "recorded"; value: T } | { type: "notRecorded" };

export type SerializedConsultedAt = {
  precision: ConsultedAtPrecision;
  value: string;
};

export type KarteTableRow = {
  id: string;
  recordedAt: string;
  consultedAt: Recorded<SerializedConsultedAt>;
  client: Recorded<{
    type: string;
    name: string;
    studentId?: string;
    affiliation?: string;
    affiliationData?: {
      courseType: "undergraduate" | "master" | "doctoral" | "professional";
      faculty: string;
      department: string;
      year: number | null;
    };
  }>;
  consent: {
    liabilityConsent: boolean;
    disclosureConsent: boolean;
  };
  consultation: {
    targetDevice: Recorded<string>;
    categories: Recorded<readonly { id: string; displayName: string }[]>;
    troubleDetails: Recorded<string>;
  };
  assignedMemberNames: string[];
  supportRecord: {
    content: Recorded<string>;
    resolution: Recorded<{ type: "resolved" } | { type: "unresolved"; followUp?: string }>;
    workDuration: Recorded<number>;
  };
  error?: string;
  fixed?: boolean;
  warning?: string;
};

// ============================================================================
// Column definitions
// ============================================================================

export const COLUMNS = [
  { key: "id", label: "ID", defaultVisible: false },
  { key: "recordedAt", label: "記録日時", defaultVisible: true },
  { key: "consultedAt", label: "相談日時", defaultVisible: true },
  { key: "client", label: "相談者", defaultVisible: true },
  { key: "consent", label: "同意", defaultVisible: false },
  { key: "targetDevice", label: "対象端末", defaultVisible: true },
  { key: "categories", label: "カテゴリ", defaultVisible: true },
  { key: "troubleDetails", label: "トラブル詳細", defaultVisible: true },
  { key: "supportContent", label: "対応内容", defaultVisible: true },
  { key: "assignee", label: "担当者", defaultVisible: true },
  { key: "resolution", label: "ステータス", defaultVisible: true },
  { key: "workDuration", label: "作業時間", defaultVisible: false },
] as const;

export type ColumnKey = (typeof COLUMNS)[number]["key"];

// ============================================================================
// Filter logic (pure functions)
// ============================================================================

function consultedAtToDateString(ca: SerializedConsultedAt): string {
  switch (ca.precision) {
    case "year":
      return `${ca.value}-01-01`;
    case "yearMonth":
      return `${ca.value}-01`;
    case "date":
    case "datetime":
      return ca.value.slice(0, 10);
  }
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getDatePresets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const today = toDateString(now);

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fiscalYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fiscalYearStart = new Date(fiscalYear, 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  return [
    { label: "今日", from: today, to: today },
    { label: "今週", from: toDateString(weekStart), to: today },
    { label: "今月", from: toDateString(monthStart), to: today },
    { label: "今年度", from: toDateString(fiscalYearStart), to: today },
    { label: "今年", from: toDateString(yearStart), to: today },
  ];
}

export type FilterState = {
  search: string;
  statusFilter: string;
  clientTypeFilter: string;
  dateFrom: string;
  dateTo: string;
};

export function filterKartes(kartes: KarteTableRow[], filters: FilterState): KarteTableRow[] {
  return kartes.filter((karte) => {
    if (filters.statusFilter !== "all") {
      const res = karte.supportRecord.resolution;
      if (
        filters.statusFilter === "resolved" &&
        !(res.type === "recorded" && res.value.type === "resolved")
      )
        return false;
      if (
        filters.statusFilter === "unresolved" &&
        !(res.type === "recorded" && res.value.type === "unresolved")
      )
        return false;
      if (filters.statusFilter === "notRecorded" && res.type !== "notRecorded") return false;
    }

    if (filters.clientTypeFilter !== "all") {
      const type = karte.client.type === "recorded" ? karte.client.value.type : "";
      if (type !== filters.clientTypeFilter) return false;
    }

    if (filters.dateFrom || filters.dateTo) {
      if (karte.consultedAt.type !== "recorded") return false;
      const date = consultedAtToDateString(karte.consultedAt.value);
      if (filters.dateFrom && date < filters.dateFrom) return false;
      if (filters.dateTo && date > filters.dateTo) return false;
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const texts = [
        karte.client.type === "recorded" ? karte.client.value.name : "",
        karte.client.type === "recorded" ? (karte.client.value.studentId ?? "") : "",
        karte.consultation.troubleDetails.type === "recorded"
          ? karte.consultation.troubleDetails.value
          : "",
        karte.supportRecord.content.type === "recorded" ? karte.supportRecord.content.value : "",
        ...karte.assignedMemberNames,
        karte.consultation.targetDevice.type === "recorded"
          ? karte.consultation.targetDevice.value
          : "",
      ];
      if (!texts.some((t) => t.toLowerCase().includes(q))) return false;
    }

    return true;
  });
}
