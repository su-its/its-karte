/** 大学構造のランタイムデータ（フォームのカスケードSelect用） */

type Faculty = { name: string; departments: string[] };

type CourseStructure = {
  label: string;
  maxYear: number;
  faculties: Faculty[];
};

export const UNIVERSITY_STRUCTURE: Record<string, CourseStructure> = {
  undergraduate: {
    label: "学部",
    maxYear: 4,
    faculties: [
      { name: "人文社会科学部", departments: ["社会学科", "言語文化学科", "法学科", "経済学科"] },
      { name: "教育学部", departments: ["学校教育教員養成課程"] },
      { name: "情報学部", departments: ["情報科学科", "行動情報学科", "情報社会学科"] },
      { name: "理学部", departments: ["数学科", "物理学科", "化学科", "生物科学科", "地球科学科"] },
      {
        name: "工学部",
        departments: [
          "機械工学科",
          "電気電子工学科",
          "電子物質科学科",
          "化学バイオ工学科",
          "数理システム工学科",
        ],
      },
      { name: "農学部", departments: ["生物資源科学科", "応用生命科学科"] },
      { name: "グローバル共創科学部", departments: ["グローバル共創科学科"] },
      { name: "地域創造学環", departments: [] },
    ],
  },
  master: {
    label: "修士",
    maxYear: 2,
    faculties: [
      {
        name: "人文社会科学研究科",
        departments: ["臨床人間科学専攻", "比較地域文化専攻", "経済専攻"],
      },
      {
        name: "総合科学技術研究科",
        departments: ["情報学専攻", "理学専攻", "工学専攻", "農学専攻"],
      },
      { name: "山岳流域研究院", departments: [] },
    ],
  },
  doctoral: {
    label: "博士",
    maxYear: 3,
    faculties: [
      {
        name: "創造科学技術大学院",
        departments: [
          "ナノビジョン工学専攻",
          "光・ナノ物質機能専攻",
          "情報科学専攻",
          "環境・エネルギーシステム専攻",
          "バイオサイエンス専攻",
        ],
      },
      { name: "教育学研究科", departments: ["共同教科開発学専攻"] },
      { name: "光医工学研究科", departments: ["光医工学共同専攻"] },
    ],
  },
  professional: {
    label: "専門職",
    maxYear: 2,
    faculties: [{ name: "教育学研究科", departments: ["教育実践高度化専攻"] }],
  },
} as const;

export type CourseType = keyof typeof UNIVERSITY_STRUCTURE;

export function getFaculties(courseType: string): Faculty[] {
  return UNIVERSITY_STRUCTURE[courseType]?.faculties ?? [];
}

export function getDepartments(courseType: string, faculty: string): string[] {
  return getFaculties(courseType).find((f) => f.name === faculty)?.departments ?? [];
}

export function getMaxYear(courseType: string): number {
  return UNIVERSITY_STRUCTURE[courseType]?.maxYear ?? 4;
}

export function getCourseLabel(courseType: string): string {
  return UNIVERSITY_STRUCTURE[courseType]?.label ?? courseType;
}
