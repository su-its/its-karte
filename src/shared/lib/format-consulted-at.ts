import type { ConsultedAtPrecision } from "@/shared/api";

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
