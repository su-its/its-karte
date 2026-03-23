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

/** 学部名マッピング */
const FACULTY_MAPPING: Record<string, string> = {
  info: "情報学部",
  enge: "工学部",
  eng: "工学部",
  sci: "理学部",
  agr: "農学部",
  edu: "教育学部",
  hum: "人文社会科学部",
  glo: "グローバル共創科学部",
  reg: "地域創造学環",
};

/** 学科名マッピング */
const DEPARTMENT_MAPPING: Record<string, string> = {
  cs: "情報科学科",
  bi: "行動情報学科",
  ia: "情報社会学科",
  me: "機械工学科",
  ee: "電気電子工学科",
};

type CsvFormat = "google_forms" | "consultation_table";

/** CSVフォーマットを判定（最初のヘッダーセルで判定） */
function detectFormat(headerRow: string[]): CsvFormat {
  const firstHeader = (headerRow[0] || "").trim();
  return firstHeader === "タイムスタンプ" ? "google_forms" : "consultation_table";
}

/** 相談テーブル形式の行を標準形式に変換 */
function parseConsultationTableRow(cols: string[], index: number): CsvRow {
  if (cols.length < 14) {
    throw new Error(`行 ${index + 2}: カラム数が不足 (${cols.length}/14)`);
  }

  const dateStr = cols[0].trim(); // 日時（日付のみ）
  const studentId = cols[1].trim(); // 相談者生徒番号
  const gradeNum = cols[2].trim(); // 学年
  const facultyAbbr = cols[3].trim().toLowerCase(); // 学部（略称）
  const deptAbbr = cols[4].trim().toLowerCase(); // 学科（略称）
  const targetDevice = cols[5].trim(); // 対象端末
  const categoryTags = cols[6].trim(); // 相談内容タグ
  const troubleDetails = cols[7].trim(); // 相談内容
  const supportContent = cols[8].trim(); // トラブルに対する処理内容
  const workDurationMin = cols[9].trim(); // 作業時間(min)
  const resolution = cols[10].trim(); // 解決の成否（"解決"/"未解決"）
  const followUp = cols[11].trim(); // 未解決の場合の後処理
  const assignee = cols[12].trim(); // 担当者
  const consent = cols[13].trim(); // 同意（"同意あり"）

  // 相談者種別の判定: staff/teacher/other は学部ではなく相談者タイプ
  const NON_STUDENT_TYPES: Record<string, string> = {
    staff: "職員",
    teacher: "教員",
    other: "その他",
  };
  const isNonStudent = facultyAbbr in NON_STUDENT_TYPES;

  // 名前：学籍番号がなければフォールバック
  const name = studentId || "";

  // 学部・学科マッピング
  const faculty = isNonStudent ? "" : FACULTY_MAPPING[facultyAbbr] || facultyAbbr;
  const department = isNonStudent ? "" : DEPARTMENT_MAPPING[deptAbbr] || deptAbbr;

  // 学年：学生なら「学部N年」、職員等はそのまま種別名
  const gradeStr = isNonStudent
    ? NON_STUDENT_TYPES[facultyAbbr]
    : gradeNum
      ? `学部${gradeNum}年`
      : "";

  // 同意：「同意あり」→「同意する」
  const mappedConsent = consent === "同意あり" ? "同意する" : "";

  return {
    timestamp: dateStr,
    date: dateStr,
    studentId,
    name,
    faculty,
    department,
    grade: gradeStr,
    disclosureConsent: mappedConsent,
    liabilityConsent: mappedConsent,
    targetDevice,
    categoryTags,
    troubleDetails,
    supportContent,
    resolution: resolution === "解決" ? "解決" : resolution === "未解決" ? "未解決" : "",
    followUp,
    assignee,
    workDuration: workDurationMin,
  };
}

/** Google Forms形式の行を標準形式に変換 */
function parseGoogleFormsRow(cols: string[], index: number): CsvRow {
  if (cols.length < 17) {
    throw new Error(`行 ${index + 2}: カラム数が不足 (${cols.length}/17)`);
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
}

/** CSVテキストをパースしてCsvRow配列を返す（自動フォーマット判定） */
export function parseCsv(text: string): CsvRow[] {
  const rows = parseCsvText(text);

  if (rows.length === 0) {
    return [];
  }

  const headerRow = rows[0];
  const format = detectFormat(headerRow);

  return rows.slice(1).map((cols, i) => {
    if (format === "google_forms") {
      return parseGoogleFormsRow(cols, i);
    } else {
      return parseConsultationTableRow(cols, i);
    }
  });
}
