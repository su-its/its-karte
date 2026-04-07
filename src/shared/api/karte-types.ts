/** 相談日時の精度 */
export type ConsultedAtPrecision = "datetime" | "date" | "yearMonth" | "year";

/** メンバー選択肢（UI表示用DTO） */
export type MemberOption = {
  id: string;
  name: string;
  studentId?: string;
  department?: string;
  email?: string;
};

/** カテゴリ選択肢 */
export type CategoryOption = { id: string; displayName: string };
