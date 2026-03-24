import {
  CONSULTATION_CATEGORIES,
  type MemberId,
  type ConsultationCategory,
  type ConsultationCategoryId,
} from "@shizuoka-its/core";
import type { CsvRow } from "./parseCsv.js";

/** メンバーの学籍番号→MemberId対応 */
export type MemberMapping = ReadonlyMap<string, MemberId>;

/** 変換結果 */
export type ConvertResult =
  | { readonly ok: true; readonly params: ReconstructParams }
  | { readonly ok: false; readonly error: string };

/** Karte.reconstruct に渡すパラメータの素材 */
export type ReconstructParams = {
  readonly recordedAt: Date;
  readonly consultedAt: Date;
  readonly client: ClientParams;
  readonly consent: { liabilityConsent: boolean; disclosureConsent: boolean };
  readonly categories: ConsultationCategory[];
  readonly targetDevice: string;
  readonly troubleDetails: string;
  readonly assignedMemberIds: MemberId[];
  readonly supportContent: string;
  readonly resolution: "resolved" | "unresolved";
  readonly followUp: string | null;
  readonly workDurationMinutes: number | null;
};

export type ClientParams =
  | {
      type: "student";
      studentId: string;
      name: string;
      faculty: string;
      department: string;
      grade: string;
    }
  | {
      type: "staff";
      name: string;
    };

/** CSVのカテゴリタグID→ドメインのConsultationCategoryIdマッピング */
const TAG_MAPPING: Record<string, ConsultationCategoryId> = {
  wifi_eduroam: "wifi_eduroam",
  wifi_succes: "wifi_success", // CSVのタイポ対応
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
  problem_os: "problem_windows", // CSVの"problem_os"をドメインの"problem_windows"にマッピング
  problem_windows: "problem_windows",
  problem_linux: "problem_linux",
  programming: "programming",
  rent: "rent",
  other: "other",
};

/** CSVの「学年」文字列をパースする */
function parseGrade(grade: string): { type: "student" | "staff"; year?: number; course?: string } {
  if (grade === "職員") {
    return { type: "staff" };
  }
  // "学部 3年" or "修士 1年"
  const match = grade.match(/^(学部|修士|博士)\s*(\d+)年$/);
  if (!match) {
    throw new Error(`学年のパースに失敗: ${grade}`);
  }
  return { type: "student", course: match[1], year: Number(match[2]) };
}

/** CSVのカテゴリタグ文字列からIDを抽出する */
function parseCategoryTags(tags: string): ConsultationCategory[] {
  return tags.split(", ").map((tag) => {
    const id = tag.split(" ")[0]; // "wifi_smartphone (説明)" → "wifi_smartphone"
    const mappedId = TAG_MAPPING[id];
    if (!mappedId) {
      throw new Error(`未知のカテゴリタグ: ${id}`);
    }
    const master = CONSULTATION_CATEGORIES.find((c) => c.id === mappedId);
    return { id: mappedId, displayName: master?.displayName ?? mappedId };
  });
}

/** 日時文字列をDateに変換する */
function parseDate(dateStr: string): Date {
  // "2025/10/01 17:53:14" → Date
  const d = new Date(dateStr.replace(/\//g, "-"));
  if (Number.isNaN(d.getTime())) {
    throw new Error(`日時のパースに失敗: ${dateStr}`);
  }
  return d;
}

/** CSV1行をドメインモデル用パラメータに変換する */
export function convertRow(
  row: CsvRow,
  rowIndex: number,
  memberMapping: MemberMapping,
): ConvertResult {
  try {
    const gradeInfo = parseGrade(row.grade);

    // クライアント情報
    let client: ClientParams;
    if (gradeInfo.type === "staff") {
      client = { type: "staff", name: row.name };
    } else {
      client = {
        type: "student",
        studentId: row.studentId,
        name: row.name,
        faculty: row.faculty,
        department: row.department,
        grade: row.grade,
      };
    }

    // 担当者の解決
    const assigneeIds = row.assignee
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const assignedMemberIds: MemberId[] = [];
    const unmappedAssignees: string[] = [];

    for (const assigneeId of assigneeIds) {
      const memberId = memberMapping.get(assigneeId);
      if (memberId) {
        assignedMemberIds.push(memberId);
      } else {
        unmappedAssignees.push(assigneeId);
      }
    }

    if (unmappedAssignees.length > 0) {
      return {
        ok: false,
        error: `行 ${rowIndex + 2}: 担当者のMemberIdが見つかりません: ${unmappedAssignees.join(", ")}`,
      };
    }

    // 解決ステータス
    const resolution = row.resolution === "解決" ? ("resolved" as const) : ("unresolved" as const);
    const followUp = row.followUp || null;

    // 作業時間
    const workDurationMinutes = row.workDuration ? Number(row.workDuration) : null;
    if (workDurationMinutes !== null && Number.isNaN(workDurationMinutes)) {
      return {
        ok: false,
        error: `行 ${rowIndex + 2}: 作業時間のパースに失敗: ${row.workDuration}`,
      };
    }

    return {
      ok: true,
      params: {
        recordedAt: parseDate(row.timestamp),
        consultedAt: parseDate(row.date),
        client,
        consent: {
          liabilityConsent: row.liabilityConsent === "同意する",
          disclosureConsent: row.disclosureConsent === "同意する",
        },
        categories: parseCategoryTags(row.categoryTags),
        targetDevice: row.targetDevice,
        troubleDetails: row.troubleDetails,
        supportContent: row.supportContent,
        resolution,
        followUp,
        assignedMemberIds,
        workDurationMinutes,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: `行 ${rowIndex + 2}: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
