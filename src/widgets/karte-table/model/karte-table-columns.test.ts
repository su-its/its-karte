import { expect, test, describe } from "vite-plus/test";
import { filterKartes, getDatePresets } from "./karte-table-columns";
import type { KarteTableRow, FilterState } from "./karte-table-columns";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_FILTERS: FilterState = {
  search: "",
  statusFilter: "all",
  clientTypeFilter: "all",
  dateFrom: "",
  dateTo: "",
};

function makeRow(overrides: Partial<KarteTableRow> = {}): KarteTableRow {
  return {
    id: "k-1",
    recordedAt: "2025-01-01T00:00:00Z",
    consultedAt: {
      type: "recorded",
      value: { precision: "date", value: "2025-01-15" },
    },
    client: {
      type: "recorded",
      value: { type: "student", name: "山田太郎", studentId: "12345678" },
    },
    consent: { liabilityConsent: true, disclosureConsent: true },
    consultation: {
      targetDevice: { type: "recorded", value: "ノートPC" },
      categories: { type: "recorded", value: [{ id: "c1", displayName: "Wi-Fi" }] },
      troubleDetails: { type: "recorded", value: "接続できない" },
    },
    assignedMemberNames: ["佐藤"],
    supportRecord: {
      content: { type: "recorded", value: "再起動で解決" },
      resolution: { type: "recorded", value: { type: "resolved" } },
      workDuration: { type: "recorded", value: 15 },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// filterKartes
// ---------------------------------------------------------------------------

describe("filterKartes", () => {
  const resolved = makeRow();
  const unresolved = makeRow({
    id: "k-2",
    supportRecord: {
      content: { type: "recorded", value: "調査中" },
      resolution: { type: "recorded", value: { type: "unresolved" } },
      workDuration: { type: "recorded", value: 5 },
    },
  });
  const notRecorded = makeRow({
    id: "k-3",
    supportRecord: {
      content: { type: "notRecorded" },
      resolution: { type: "notRecorded" },
      workDuration: { type: "notRecorded" },
    },
  });
  const rows = [resolved, unresolved, notRecorded];

  test("all フィルタは全件返す", () => {
    expect(filterKartes(rows, BASE_FILTERS)).toHaveLength(3);
  });

  test("resolved フィルタ", () => {
    const result = filterKartes(rows, { ...BASE_FILTERS, statusFilter: "resolved" });
    expect(result).toEqual([resolved]);
  });

  test("unresolved フィルタ", () => {
    const result = filterKartes(rows, { ...BASE_FILTERS, statusFilter: "unresolved" });
    expect(result).toEqual([unresolved]);
  });

  test("notRecorded フィルタ", () => {
    const result = filterKartes(rows, { ...BASE_FILTERS, statusFilter: "notRecorded" });
    expect(result).toEqual([notRecorded]);
  });

  test("clientType フィルタ", () => {
    const staff = makeRow({
      id: "k-4",
      client: { type: "recorded", value: { type: "staff", name: "職員A" } },
    });
    const result = filterKartes([resolved, staff], { ...BASE_FILTERS, clientTypeFilter: "staff" });
    expect(result).toEqual([staff]);
  });

  test("日付範囲フィルタ — 範囲内", () => {
    const result = filterKartes(rows, {
      ...BASE_FILTERS,
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });
    expect(result.map((r) => r.id)).toContain("k-1");
  });

  test("日付範囲フィルタ — 範囲外", () => {
    const result = filterKartes(rows, {
      ...BASE_FILTERS,
      dateFrom: "2025-02-01",
      dateTo: "2025-02-28",
    });
    expect(result.every((r) => r.consultedAt.type === "notRecorded" || false)).toBe(true);
  });

  test("テキスト検索 — 相談者名", () => {
    const result = filterKartes(rows, { ...BASE_FILTERS, search: "山田" });
    expect(result.map((r) => r.id)).toContain("k-1");
  });

  test("テキスト検索 — 担当者名", () => {
    const result = filterKartes(rows, { ...BASE_FILTERS, search: "佐藤" });
    expect(result).toHaveLength(3); // all rows have 佐藤
  });

  test("テキスト検索 — 大文字小文字を区別しない", () => {
    const row = makeRow({
      consultation: {
        targetDevice: { type: "recorded", value: "MacBook" },
        categories: { type: "recorded", value: [] },
        troubleDetails: { type: "recorded", value: "test" },
      },
    });
    expect(filterKartes([row], { ...BASE_FILTERS, search: "macbook" })).toHaveLength(1);
  });

  test("consultedAt が notRecorded の行は日付フィルタで除外", () => {
    const noDate = makeRow({ id: "k-no-date", consultedAt: { type: "notRecorded" } });
    const result = filterKartes([noDate], {
      ...BASE_FILTERS,
      dateFrom: "2025-01-01",
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getDatePresets
// ---------------------------------------------------------------------------

describe("getDatePresets", () => {
  test("5つのプリセットを返す", () => {
    const presets = getDatePresets();
    expect(presets).toHaveLength(5);
    expect(presets.map((p) => p.label)).toEqual(["今日", "今週", "今月", "今年度", "今年"]);
  });

  test("各プリセットの from <= to", () => {
    for (const preset of getDatePresets()) {
      expect(preset.from <= preset.to).toBe(true);
    }
  });
});
