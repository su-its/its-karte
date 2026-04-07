import type { CsvRow } from "./parse-csv";

/** 重複検出用のキーを生成する（タイムスタンプ+学籍番号+トラブル詳細の先頭50文字） */
function dedupKey(row: CsvRow): string {
  return `${row.timestamp}|${row.studentId}|${row.troubleDetails.slice(0, 50)}`;
}

export type DedupResult = {
  readonly unique: { index: number; row: CsvRow }[];
  readonly duplicates: { index: number; row: CsvRow; duplicateOf: number }[];
};

/** 重複行を検出し、ユニークな行と重複行に分離する */
export function dedup(rows: readonly CsvRow[]): DedupResult {
  const seen = new Map<string, number>();
  const unique: { index: number; row: CsvRow }[] = [];
  const duplicates: { index: number; row: CsvRow; duplicateOf: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const key = dedupKey(rows[i]);
    const firstSeen = seen.get(key);

    if (firstSeen !== undefined) {
      duplicates.push({ index: i, row: rows[i], duplicateOf: firstSeen });
    } else {
      seen.set(key, i);
      unique.push({ index: i, row: rows[i] });
    }
  }

  return { unique, duplicates };
}
