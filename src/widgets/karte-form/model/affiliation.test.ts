import { expect, test, describe } from "vite-plus/test";
import {
  toFormKey,
  buildSelections,
  computeAutoSkip,
  diffSelectionsToFormUpdates,
  clearAffiliation,
} from "./affiliation";
import type { KarteFormValues } from "./karte-form-values";
import { DEFAULTS } from "./karte-form-values";

describe("toFormKey", () => {
  test("school を faculty に変換する", () => {
    expect(toFormKey("school")).toBe("faculty");
  });

  test("school 以外はそのまま返す", () => {
    expect(toFormKey("department")).toBe("department");
    expect(toFormKey("major")).toBe("major");
    expect(toFormKey("faculty")).toBe("faculty");
  });
});

describe("buildSelections", () => {
  test("学士課程の値を selections に変換する", () => {
    const values: KarteFormValues = {
      ...DEFAULTS,
      courseType: "undergraduate",
      faculty: "情報学部",
      department: "情報科学科",
    };
    const selections = buildSelections(values);
    expect(selections.faculty).toBe("情報学部");
    expect(selections.department).toBe("情報科学科");
    expect(selections.school).toBeUndefined();
  });

  test("修士課程では faculty を school にもマッピングする", () => {
    const values: KarteFormValues = {
      ...DEFAULTS,
      courseType: "master",
      faculty: "総合科学技術研究科",
    };
    const selections = buildSelections(values);
    expect(selections.faculty).toBe("総合科学技術研究科");
    expect(selections.school).toBe("総合科学技術研究科");
  });

  test("空文字のフィールドは selections に含めない", () => {
    const values: KarteFormValues = {
      ...DEFAULTS,
      courseType: "undergraduate",
      faculty: "情報学部",
      department: "",
    };
    const selections = buildSelections(values);
    expect(selections.faculty).toBe("情報学部");
    expect(selections.department).toBeUndefined();
  });
});

describe("computeAutoSkip", () => {
  test("専門職学位課程で研究科・専攻が自動選択される", () => {
    const result = computeAutoSkip("professional", {});
    expect(result.school).toBe("教育学研究科");
    expect(result.major).toBe("教育実践高度化専攻");
  });

  test("学士課程では auto-skip されない（複数選択肢あり）", () => {
    const result = computeAutoSkip("undergraduate", {});
    expect(result.faculty).toBeUndefined();
  });

  test("教育学部→学校教育教員養成課程が auto-skip される", () => {
    const result = computeAutoSkip("undergraduate", { faculty: "教育学部" });
    expect(result.program).toBe("学校教育教員養成課程");
  });
});

describe("diffSelectionsToFormUpdates", () => {
  test("変更があったフィールドのみ更新を返す", () => {
    const before = { faculty: "A" };
    const after = { faculty: "A", department: "B" };
    const updates = diffSelectionsToFormUpdates(before, after);
    expect(updates).toEqual([{ key: "department", value: "B" }]);
  });

  test("school は faculty に変換される", () => {
    const before = {};
    const after = { school: "研究科A" };
    const updates = diffSelectionsToFormUpdates(before, after);
    expect(updates).toEqual([{ key: "faculty", value: "研究科A" }]);
  });
});

describe("clearAffiliation", () => {
  test("所属フィールドがすべて空文字になる", () => {
    const cleared = clearAffiliation();
    expect(cleared.faculty).toBe("");
    expect(cleared.department).toBe("");
    expect(cleared.major).toBe("");
    expect(cleared.year).toBe("");
  });
});
