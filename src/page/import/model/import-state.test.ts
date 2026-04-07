import { expect, test, describe } from "vite-plus/test";
import { importReducer, INITIAL_STATE } from "./import-state";
import type { ImportState } from "./import-state";
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

function stateWithRows(...rows: CsvRow[]): ImportState {
  return { ...INITIAL_STATE, step: "validation", rows };
}

// ---------------------------------------------------------------------------
// FILE_LOADED
// ---------------------------------------------------------------------------

describe("FILE_LOADED", () => {
  test("step を validation に遷移し、データをセットする", () => {
    const rows = [makeRow()];
    const next = importReducer(INITIAL_STATE, {
      type: "FILE_LOADED",
      rows,
      members: [],
      kartes: [],
      categories: [],
      initialErrors: new Set([0]),
    });
    expect(next.step).toBe("validation");
    expect(next.rows).toBe(rows);
    expect(next.initialErrorIndices.has(0)).toBe(true);
    expect(next.error).toBeNull();
  });

  test("memberMapping をリセットする", () => {
    const prev = { ...INITIAL_STATE, memberMapping: new Map([["A", "m1"]]) };
    const next = importReducer(prev, {
      type: "FILE_LOADED",
      rows: [],
      members: [],
      kartes: [],
      categories: [],
      initialErrors: new Set(),
    });
    expect(next.memberMapping.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FILE_ERROR
// ---------------------------------------------------------------------------

describe("FILE_ERROR", () => {
  test("エラーメッセージをセットする", () => {
    const next = importReducer(INITIAL_STATE, {
      type: "FILE_ERROR",
      error: "CSVの読み込みに失敗しました",
    });
    expect(next.error).toBe("CSVの読み込みに失敗しました");
    expect(next.step).toBe("upload"); // step は変わらない
  });
});

// ---------------------------------------------------------------------------
// OPEN_EDITOR / CLOSE_EDITOR
// ---------------------------------------------------------------------------

describe("OPEN_EDITOR / CLOSE_EDITOR", () => {
  test("OPEN_EDITOR で編集状態を原子的にセットする", () => {
    const errorFields = new Set<keyof CsvRow>(["name", "studentId"]);
    const formValues = { clientName: "山田" };
    const next = importReducer(INITIAL_STATE, {
      type: "OPEN_EDITOR",
      index: 3,
      errorFields,
      formValues,
    });
    expect(next.editingRowIndex).toBe(3);
    expect(next.frozenEditableFields).toBe(errorFields);
    expect(next.originalFormValues).toBe(formValues);
  });

  test("CLOSE_EDITOR で編集状態をクリアする", () => {
    const prev: ImportState = {
      ...INITIAL_STATE,
      editingRowIndex: 3,
      frozenEditableFields: new Set<keyof CsvRow>(["name"]),
      originalFormValues: { clientName: "山田" },
    };
    const next = importReducer(prev, { type: "CLOSE_EDITOR" });
    expect(next.editingRowIndex).toBeNull();
    expect(next.frozenEditableFields.size).toBe(0);
    expect(next.originalFormValues).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MARK_NOT_RECORDED
// ---------------------------------------------------------------------------

describe("MARK_NOT_RECORDED", () => {
  test("フィールドを notRecordedFieldsMap に追加し、行の値を空にする", () => {
    const state = stateWithRows(makeRow({ name: "山田太郎" }));
    const next = importReducer(state, {
      type: "MARK_NOT_RECORDED",
      rowIndex: 0,
      field: "name",
    });
    expect(next.notRecordedFieldsMap.get(0)?.has("name")).toBe(true);
    expect(next.rows[0].name).toBe("");
  });

  test("元の行を変更しない（イミュータブル）", () => {
    const original = makeRow();
    const state = stateWithRows(original);
    importReducer(state, {
      type: "MARK_NOT_RECORDED",
      rowIndex: 0,
      field: "name",
    });
    expect(original.name).toBe("山田太郎");
  });
});

// ---------------------------------------------------------------------------
// UPDATE_ROW
// ---------------------------------------------------------------------------

describe("UPDATE_ROW", () => {
  test("指定インデックスの行を置換する", () => {
    const state = stateWithRows(makeRow({ name: "A" }), makeRow({ name: "B" }));
    const updated = makeRow({ name: "C" });
    const next = importReducer(state, { type: "UPDATE_ROW", index: 1, row: updated });
    expect(next.rows[0].name).toBe("A");
    expect(next.rows[1].name).toBe("C");
  });
});

// ---------------------------------------------------------------------------
// RESOLVE_ASSIGNEE
// ---------------------------------------------------------------------------

describe("RESOLVE_ASSIGNEE", () => {
  test("メンバーマッピングに追加する", () => {
    const next = importReducer(INITIAL_STATE, {
      type: "RESOLVE_ASSIGNEE",
      name: "佐藤",
      memberId: "m-001",
    });
    expect(next.memberMapping.get("佐藤")).toBe("m-001");
  });

  test("既存のマッピングを上書きする", () => {
    const prev = { ...INITIAL_STATE, memberMapping: new Map([["佐藤", "m-old"]]) };
    const next = importReducer(prev, {
      type: "RESOLVE_ASSIGNEE",
      name: "佐藤",
      memberId: "m-new",
    });
    expect(next.memberMapping.get("佐藤")).toBe("m-new");
  });
});

// ---------------------------------------------------------------------------
// TOGGLE_SKIP
// ---------------------------------------------------------------------------

describe("TOGGLE_SKIP", () => {
  test("スキップを追加する", () => {
    const next = importReducer(INITIAL_STATE, { type: "TOGGLE_SKIP", index: 5 });
    expect(next.skippedIndices.has(5)).toBe(true);
  });

  test("スキップを解除する", () => {
    const prev = { ...INITIAL_STATE, skippedIndices: new Set([5]) };
    const next = importReducer(prev, { type: "TOGGLE_SKIP", index: 5 });
    expect(next.skippedIndices.has(5)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Step transitions
// ---------------------------------------------------------------------------

describe("ステップ遷移", () => {
  test("START_IMPORT → importing", () => {
    const next = importReducer(INITIAL_STATE, { type: "START_IMPORT" });
    expect(next.step).toBe("importing");
  });

  test("IMPORT_DONE → done + result", () => {
    const result = { total: 10, succeeded: 9, failed: [{ index: 3, error: "err" }] };
    const next = importReducer(INITIAL_STATE, { type: "IMPORT_DONE", result });
    expect(next.step).toBe("done");
    expect(next.result).toBe(result);
  });

  test("PROCEED_TO_DUPLICATES → duplicates + skipIndices", () => {
    const skipIndices = new Set([1, 3]);
    const next = importReducer(INITIAL_STATE, {
      type: "PROCEED_TO_DUPLICATES",
      skipIndices,
    });
    expect(next.step).toBe("duplicates");
    expect(next.skippedIndices).toBe(skipIndices);
  });

  test("BACK_TO_VALIDATION → validation", () => {
    const prev = { ...INITIAL_STATE, step: "duplicates" as const };
    const next = importReducer(prev, { type: "BACK_TO_VALIDATION" });
    expect(next.step).toBe("validation");
  });
});

// ---------------------------------------------------------------------------
// EXPAND_DUPLICATES / SET_COMPARING
// ---------------------------------------------------------------------------

describe("EXPAND_DUPLICATES", () => {
  test("インデックスを展開セットに追加する", () => {
    const next = importReducer(INITIAL_STATE, { type: "EXPAND_DUPLICATES", index: 2 });
    expect(next.expandedDuplicates.has(2)).toBe(true);
  });
});

describe("SET_COMPARING", () => {
  test("比較インデックスをセットする", () => {
    const next = importReducer(INITIAL_STATE, { type: "SET_COMPARING", index: 7 });
    expect(next.comparingIndex).toBe(7);
  });

  test("null で比較を閉じる", () => {
    const prev = { ...INITIAL_STATE, comparingIndex: 7 };
    const next = importReducer(prev, { type: "SET_COMPARING", index: null });
    expect(next.comparingIndex).toBeNull();
  });
});
