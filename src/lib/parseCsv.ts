/** CSVの1行を表す生データ */
export type CsvRow = {
  timestamp: string;
  date: string;
  studentId: string;
  name: string;
  faculty: string;
  department: string;
  grade: string;
  disclosureConsent: string;
  liabilityConsent: string;
  targetDevice: string;
  categoryTags: string;
  troubleDetails: string;
  supportContent: string;
  resolution: string;
  followUp: string;
  assignee: string;
  workDuration: string;
};

/**
 * RFC 4180準拠のCSVパーサー
 * Google Formsの出力（フィールド内改行あり）に対応
 */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field);
        field = "";
        i++;
      } else if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i += 2;
      } else if (ch === "\n") {
        current.push(field);
        field = "";
        rows.push(current);
        current = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (field.length > 0 || current.length > 0) {
    current.push(field);
    rows.push(current);
  }

  return rows;
}

/** CSVテキストをパースしてCsvRow配列を返す（ブラウザ・サーバー両方で使用可能） */
export function parseCsv(text: string): CsvRow[] {
  const rows = parseCsvText(text);

  return rows.slice(1).map((cols, i) => {
    if (cols.length < 17) {
      throw new Error(`行 ${i + 2}: カラム数が不足 (${cols.length}/17)`);
    }
    return {
      timestamp: cols[0],
      date: cols[1],
      studentId: cols[2],
      name: cols[3],
      faculty: cols[4],
      department: cols[5],
      grade: cols[6],
      disclosureConsent: cols[7],
      liabilityConsent: cols[8],
      targetDevice: cols[9],
      categoryTags: cols[10],
      troubleDetails: cols[11],
      supportContent: cols[12],
      resolution: cols[13],
      followUp: cols[14],
      assignee: cols[15],
      workDuration: cols[16],
    };
  });
}
