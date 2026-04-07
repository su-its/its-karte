import {
  CONSULTATION_CATEGORIES,
  type ConsultationCategory,
  type ConsultationCategoryId,
} from "@shizuoka-its/core";

/** CSVのカテゴリタグ文字列→ドメインのConsultationCategoryIdマッピング */
export const TAG_MAPPING: Record<string, ConsultationCategoryId> = {
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

/** CSVのカテゴリタグ文字列をパースしてConsultationCategory配列に変換する */
export function parseCategoryTags(tags: string): ConsultationCategory[] {
  return tags
    .split(", ")
    .map((tag) => {
      const mappedId = TAG_MAPPING[tag.split(" ")[0]];
      if (!mappedId) return null;
      const master = CONSULTATION_CATEGORIES.find((c) => c.id === mappedId);
      return { id: mappedId, displayName: master?.displayName ?? mappedId };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
