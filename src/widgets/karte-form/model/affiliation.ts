import { getAffiliationSteps } from "@shizuoka-its/core";
import type { KarteFormValues } from "./karte-form-values";

/** 所属関連のフォームフィールド名一覧 */
export const AFFILIATION_FIELDS: (keyof KarteFormValues)[] = [
  "faculty",
  "enrollmentType",
  "program",
  "department",
  "major",
  "course",
  "subspecialty",
  "year",
];

/**
 * getAffiliationSteps が返す field 名をフォームのキーに変換する。
 * 修士・博士・専門職では "school" が返るが、フォームでは "faculty" に統一している。
 */
export function toFormKey(field: string): keyof KarteFormValues {
  return (field === "school" ? "faculty" : field) as keyof KarteFormValues;
}

/** フォーム値から getAffiliationSteps に渡す selections を構築する */
export function buildSelections(values: KarteFormValues): Record<string, string> {
  const selections: Record<string, string> = {};
  for (const f of AFFILIATION_FIELDS) {
    const v = values[f];
    if (typeof v === "string" && v) selections[f] = v;
  }
  if (values.courseType !== "undergraduate" && values.faculty) {
    selections.school = values.faculty;
  }
  return selections;
}

/**
 * auto-skip を適用した後の新しい selections を返す（純粋関数）。
 * 選択肢が1つしかないステップを自動的に進める。
 */
export function computeAutoSkip(
  courseType: KarteFormValues["courseType"],
  initialSelections: Record<string, string>,
): Record<string, string> {
  const selections = { ...initialSelections };
  for (;;) {
    const steps = getAffiliationSteps(courseType, selections);
    const nextStep = steps.find((step) => !selections[step.field]);
    if (!nextStep || nextStep.options.length !== 1) break;
    selections[nextStep.field] = nextStep.options[0];
  }
  return selections;
}

/** selections の差分から、フォームに設定すべきフィールド更新を計算する */
export function diffSelectionsToFormUpdates(
  before: Record<string, string>,
  after: Record<string, string>,
): Array<{ key: keyof KarteFormValues; value: string }> {
  const updates: Array<{ key: keyof KarteFormValues; value: string }> = [];
  for (const [field, value] of Object.entries(after)) {
    if (before[field] !== value) {
      updates.push({ key: toFormKey(field), value });
    }
  }
  return updates;
}

/** 所属フィールドをすべてクリアした新しい値を返す */
export function clearAffiliation(values: KarteFormValues): Partial<KarteFormValues> {
  const cleared: Partial<KarteFormValues> = {};
  for (const f of AFFILIATION_FIELDS) {
    (cleared as Record<string, string>)[f] = "";
  }
  return cleared;
}
