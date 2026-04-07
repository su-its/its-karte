import { expect, test, describe } from "vite-plus/test";
import {
  parseGradeType,
  formatCsvAffiliation,
  fingerprintsFromCsvRow,
  findBatchDuplicates,
  validateRow,
  getErrorFields,
  csvErrorFieldsToEditableFields,
  formFieldToCsvField,
} from "./helpers";
import type { CsvRow } from "./parse-csv";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<CsvRow> = {}): CsvRow {
  return {
    timestamp: "2025/01/15 10:00:00",
    date: "2025-01-15",
    studentId: "12345678",
    name: "山田太郎",
    faculty: "情報学部",
    department: "情報科学科",
    grade: "学部1年",
    disclosureConsent: "同意する",
    liabilityConsent: "同意する",
    targetDevice: "ノートPC",
    categoryTags: "",
    troubleDetails: "接続できない",
    supportContent: "再起動で解決",
    resolution: "解決",
    followUp: "",
    assignee: "佐藤",
    workDuration: "15",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseGradeType
// ---------------------------------------------------------------------------

describe("parseGradeType", () => {
  test("職員 → staff", () => expect(parseGradeType("職員")).toBe("staff"));
  test("教員 → teacher", () => expect(parseGradeType("教員")).toBe("teacher"));
  test("その他 → other", () => expect(parseGradeType("その他")).toBe("other"));
  test("学部1年 → student", () => expect(parseGradeType("学部1年")).toBe("student"));
  test("修士2年 → student", () => expect(parseGradeType("修士2年")).toBe("student"));
});

// ---------------------------------------------------------------------------
// formatCsvAffiliation
// ---------------------------------------------------------------------------

describe("formatCsvAffiliation", () => {
  test("学部の所属を整形", () => {
    const row = makeRow({ grade: "学部3年" });
    expect(formatCsvAffiliation(row)).toBe("情報学部 情報科学科 3年");
  });

  test("修士の所属を整形", () => {
    const row = makeRow({ grade: "修士1年", faculty: "総合科学技術研究科" });
    expect(formatCsvAffiliation(row)).toBe("総合科学技術研究科 情報科学科 修士1年");
  });

  test("パターンに一致しない場合はgradeをそのまま返す", () => {
    const row = makeRow({ grade: "職員" });
    expect(formatCsvAffiliation(row)).toBe("職員");
  });
});

// ---------------------------------------------------------------------------
// fingerprintsFromCsvRow
// ---------------------------------------------------------------------------

describe("fingerprintsFromCsvRow", () => {
  test("name|date のフィンガープリントを生成", () => {
    const row = makeRow();
    const fp = fingerprintsFromCsvRow(row);
    expect(fp.nameDate).toBe("山田太郎|2025-01-15");
  });

  test("trouble と support を100文字に切り詰める", () => {
    const long = "あ".repeat(200);
    const row = makeRow({ troubleDetails: long, supportContent: long });
    const fp = fingerprintsFromCsvRow(row);
    expect(fp.trouble).toHaveLength(100);
    expect(fp.support).toHaveLength(100);
  });

  test("dateが空ならtimestampを使用", () => {
    const row = makeRow({ date: "", timestamp: "2025/01/20 09:00:00" });
    const fp = fingerprintsFromCsvRow(row);
    expect(fp.nameDate).toBe("山田太郎|2025/01/20 09:00:00");
  });
});

// ---------------------------------------------------------------------------
// findBatchDuplicates
// ---------------------------------------------------------------------------

describe("findBatchDuplicates", () => {
  test("同じ nameDate を持つ行を重複として検出", () => {
    const row1 = makeRow();
    const row2 = makeRow({ studentId: "87654321" }); // 同名・同日
    const row3 = makeRow({
      name: "田中花子",
      studentId: "11111111",
      troubleDetails: "別の問題",
      supportContent: "別の対応",
    });
    const dupes = findBatchDuplicates([row1, row2, row3]);
    expect(dupes.has(0)).toBe(true);
    expect(dupes.has(1)).toBe(true);
    expect(dupes.has(2)).toBe(false);
  });

  test("重複なしなら空集合", () => {
    const row1 = makeRow({ name: "A", troubleDetails: "問題A", supportContent: "対応A" });
    const row2 = makeRow({ name: "B", troubleDetails: "問題B", supportContent: "対応B" });
    const dupes = findBatchDuplicates([row1, row2]);
    expect(dupes.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateRow
// ---------------------------------------------------------------------------

describe("validateRow", () => {
  test("正常な行はエラーなし", () => {
    expect(validateRow(makeRow())).toBeUndefined();
  });

  test("timestamp 空でエラー", () => {
    expect(validateRow(makeRow({ timestamp: "" }))).toContain("タイムスタンプ");
  });

  test("氏名と学籍番号の両方空でエラー", () => {
    expect(validateRow(makeRow({ name: "", studentId: "" }))).toContain("氏名または学籍番号");
  });

  test("学生で学籍番号不正", () => {
    expect(validateRow(makeRow({ studentId: "abc" }))).toContain("学籍番号が不正");
  });

  test("notRecordedFields でスキップ", () => {
    const skip = new Set<keyof CsvRow>(["timestamp"]);
    expect(validateRow(makeRow({ timestamp: "" }), skip)).toBeUndefined();
  });

  test("作業時間が数値でない", () => {
    expect(validateRow(makeRow({ workDuration: "abc" }))).toContain("作業時間が数値でない");
  });
});

// ---------------------------------------------------------------------------
// getErrorFields
// ---------------------------------------------------------------------------

describe("getErrorFields", () => {
  test("正常な行は空集合", () => {
    expect(getErrorFields(makeRow()).size).toBe(0);
  });

  test("空フィールドが検出される", () => {
    const fields = getErrorFields(makeRow({ timestamp: "", troubleDetails: "" }));
    expect(fields.has("timestamp")).toBe(true);
    expect(fields.has("troubleDetails")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

describe("csvErrorFieldsToEditableFields", () => {
  test("CSVフィールドをフォームフィールドにマッピング", () => {
    const csvFields = new Set<keyof CsvRow>(["name", "studentId"]);
    const formFields = csvErrorFieldsToEditableFields(csvFields);
    expect(formFields.has("clientName")).toBe(true);
    expect(formFields.has("studentId")).toBe(true);
  });

  test("マッピングにないフィールドは無視", () => {
    const csvFields = new Set<keyof CsvRow>(["disclosureConsent"]);
    const formFields = csvErrorFieldsToEditableFields(csvFields);
    expect(formFields.size).toBe(0);
  });
});

describe("formFieldToCsvField", () => {
  test("clientName → name", () => {
    expect(formFieldToCsvField("clientName")).toBe("name");
  });

  test("マッピングにないフィールドは undefined", () => {
    expect(formFieldToCsvField("liabilityConsent")).toBeUndefined();
  });
});
