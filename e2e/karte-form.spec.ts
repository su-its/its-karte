import { test, expect, type Page } from "@playwright/test";

// Next.js の初回コンパイルが遅いため余裕を持たせる
test.use({ navigationTimeout: 60_000, actionTimeout: 10_000 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** セクション見出しからセクションのlocatorを取得 */
function section(page: Page, title: string) {
  return page.locator("div", { has: page.getByRole("heading", { name: title }) });
}

/** SearchableMultiSelect で項目をクリック（displayName の部分一致） */
async function selectMultiItem(page: Page, placeholder: string, label: string) {
  const input = page.getByPlaceholder(placeholder);
  // 検索で絞り込み
  await input.fill(label);
  // 最初にマッチしたバッジをクリック
  const container = page.locator("div", { has: input });
  await container
    .locator(".flex.flex-wrap.gap-1\\.5.max-h-40")
    .getByText(label, { exact: false })
    .first()
    .click();
  // 検索クリア
  await input.clear();
}

/** 対応記録セクションの locator */
function resolutionSection(page: Page) {
  return section(page, "対応記録");
}

/** フォーム全体の必須項目を埋める共通ヘルパー */
async function fillRequiredFields(page: Page) {
  await page.getByPlaceholder("例: 山田太郎").fill("テスト相談者");
  await page.getByPlaceholder("例: 12345678").fill("12345678");
  await selectMultiItem(page, "カテゴリを検索...", "eduroam");
  await page.getByPlaceholder("例: ノートPC (Windows)").fill("MacBook Air");
  await page.getByPlaceholder("相談者が抱えている問題の詳細を記入").fill("Wi-Fiに接続できない");
  await selectMultiItem(page, "名前・学籍番号で検索...", "テスト太郎");
  await page.getByPlaceholder("実施した対応の詳細を記入").fill("設定を修正した");
  await page.getByRole("spinbutton").fill("15");
}

// ---------------------------------------------------------------------------
// F1: 学生カルテ作成（正常系）
// ---------------------------------------------------------------------------

test.describe("F1: 学生カルテ作成", () => {
  test("必須項目を埋めて送信すると一覧にリダイレクトされる", async ({ page }) => {
    await page.goto("/new");
    await expect(page.getByRole("heading", { name: "カルテ作成" })).toBeVisible();

    await fillRequiredFields(page);

    await page.getByRole("button", { name: "カルテを作成" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// F2: 非学生カルテ作成
// ---------------------------------------------------------------------------

test.describe("F2: 非学生カルテ作成", () => {
  for (const clientType of ["教員", "職員", "その他"] as const) {
    test(`clientType=${clientType}で学籍番号・所属が非表示`, async ({ page }) => {
      await page.goto("/new");

      await page.getByRole("button", { name: clientType, exact: true }).click();

      await expect(page.getByPlaceholder("例: 12345678")).toBeHidden();
      await expect(page.getByRole("button", { name: "学士課程" })).toBeHidden();
    });
  }

  test("教員タイプで送信成功", async ({ page }) => {
    await page.goto("/new");

    await page.getByRole("button", { name: "教員", exact: true }).click();

    await page.getByPlaceholder("例: 山田太郎").fill("教員テスト");
    await selectMultiItem(page, "カテゴリを検索...", "eduroam");
    await page.getByPlaceholder("例: ノートPC (Windows)").fill("デスクトップPC");
    await page.getByPlaceholder("相談者が抱えている問題の詳細を記入").fill("メールが送れない");
    await selectMultiItem(page, "名前・学籍番号で検索...", "テスト太郎");
    await page.getByPlaceholder("実施した対応の詳細を記入").fill("設定確認");
    await page.getByRole("spinbutton").fill("10");

    await page.getByRole("button", { name: "カルテを作成" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// F3: 未解決カルテ作成
// ---------------------------------------------------------------------------

test.describe("F3: 未解決カルテ作成", () => {
  test("未解決を選択するとフォローアップが表示され、解決に戻すと消える", async ({ page }) => {
    await page.goto("/new");

    const sec = resolutionSection(page);

    // 初期状態: フォローアップなし
    await expect(sec.getByText("後処理")).toBeHidden();

    // 未解決を選択
    await sec.getByRole("button", { name: "未解決", exact: true }).click();
    await expect(sec.getByText("後処理")).toBeVisible();

    // 解決に戻す
    await sec.getByRole("button", { name: "解決", exact: true }).click();
    await expect(sec.getByText("後処理")).toBeHidden();
  });

  test("未解決カルテを送信できる", async ({ page }) => {
    await page.goto("/new");
    await fillRequiredFields(page);

    const sec = resolutionSection(page);
    await sec.getByRole("button", { name: "未解決", exact: true }).click();

    // フォローアップを選択
    await sec.getByRole("combobox").click();
    await page.getByRole("option", { name: "技術部" }).click();

    await page.getByRole("button", { name: "カルテを作成" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// F4: バリデーションエラー → 修正 → 再送信
// ---------------------------------------------------------------------------

test.describe("F4: バリデーションエラー", () => {
  test("カテゴリ未選択でエラー、修正後に送信成功", async ({ page }) => {
    await page.goto("/new");

    await page.getByPlaceholder("例: 山田太郎").fill("テスト相談者");
    await page.getByPlaceholder("例: 12345678").fill("12345678");
    await page.getByPlaceholder("例: ノートPC (Windows)").fill("PC");
    await page.getByPlaceholder("相談者が抱えている問題の詳細を記入").fill("問題内容");
    await selectMultiItem(page, "名前・学籍番号で検索...", "テスト太郎");
    await page.getByPlaceholder("実施した対応の詳細を記入").fill("対応内容");
    await page.getByRole("spinbutton").fill("5");

    // カテゴリ未選択のまま送信
    await page.getByRole("button", { name: "カルテを作成" }).click();

    // エラーメッセージ表示
    await expect(page.getByText("カテゴリを1つ以上選択してください")).toBeVisible({
      timeout: 10_000,
    });

    // カテゴリを選択して再送信
    await selectMultiItem(page, "カテゴリを検索...", "eduroam");
    await page.getByRole("button", { name: "カルテを作成" }).click();

    await expect(page).toHaveURL("/", { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// S1: clientType変更で学籍番号・所属の表示/非表示
// ---------------------------------------------------------------------------

test.describe("S1: clientType変更", () => {
  test("学生→教員→学生の切り替えで表示が正しく切り替わる", async ({ page }) => {
    await page.goto("/new");

    await expect(page.getByPlaceholder("例: 12345678")).toBeVisible();
    await expect(page.getByRole("button", { name: "学士課程" })).toBeVisible();

    await page.getByRole("button", { name: "教員", exact: true }).click();
    await expect(page.getByPlaceholder("例: 12345678")).toBeHidden();
    await expect(page.getByRole("button", { name: "学士課程" })).toBeHidden();

    await page.getByRole("button", { name: "学生", exact: true }).click();
    await expect(page.getByPlaceholder("例: 12345678")).toBeVisible();
    await expect(page.getByRole("button", { name: "学士課程" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S2-S3: 所属ステップ（courseType × 代表パス）
// ---------------------------------------------------------------------------

test.describe("S2-S3: 所属ステップ遷移", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/new");
  });

  test("学士課程: 情報学部 → 学科 → 学年", async ({ page }) => {
    await page.getByRole("button", { name: "情報学部" }).click();

    await expect(page.getByRole("button", { name: "情報科学科" })).toBeVisible();
    await page.getByRole("button", { name: "情報科学科" }).click();

    await expect(page.getByRole("button", { name: "1年" })).toBeVisible();
    await expect(page.getByRole("button", { name: "4年" })).toBeVisible();
  });

  // BUG: 修士・博士ではgetAffiliationStepsがfield="school"を期待するが、
  // AFFILIATION_FIELDSに"school"が含まれないため、研究科選択後に
  // 次のステップ(専攻)が表示されない。
  // リファクタリング時に修正すべき既知の問題。
  test.fixme("修士課程: 研究科選択後に専攻ステップが表示される", async ({ page }) => {
    await page.getByRole("button", { name: "修士課程" }).click();
    await page.getByRole("button", { name: "総合科学技術研究科" }).click();
    await expect(page.getByRole("button", { name: "情報学専攻" })).toBeVisible();
  });

  test.fixme("博士課程: 研究科選択後に専攻ステップが表示される", async ({ page }) => {
    await page.getByRole("button", { name: "博士課程" }).click();
    await page.getByRole("button", { name: "創造科学技術大学院" }).click();
    await expect(page.getByRole("button", { name: "情報科学専攻" })).toBeVisible();
  });

  test("修士課程: 研究科ステップが表示される", async ({ page }) => {
    await page.getByRole("button", { name: "修士課程" }).click();
    for (const name of ["人文社会科学研究科", "総合科学技術研究科", "山岳流域研究院"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
  });

  test("博士課程: 研究科ステップが表示される", async ({ page }) => {
    await page.getByRole("button", { name: "博士課程" }).click();
    await expect(page.getByRole("button", { name: "創造科学技術大学院" })).toBeVisible();
    await expect(page.getByRole("button", { name: "教育学研究科" })).toBeVisible();
  });

  test("専門職学位課程: auto-skipで研究科が自動選択される", async ({ page }) => {
    await page.getByRole("button", { name: "専門職学位課程" }).click();

    // 研究科が1つしかないのでauto-skipされてボタンとして表示される
    await expect(page.getByRole("button", { name: "教育学研究科" })).toBeVisible();
  });

  test("課程切り替えで所属フィールドがクリアされる", async ({ page }) => {
    await page.getByRole("button", { name: "情報学部" }).click();
    await page.getByRole("button", { name: "情報科学科" }).click();

    await page.getByRole("button", { name: "修士課程" }).click();

    await expect(page.getByRole("button", { name: "情報学部" })).toBeHidden();
  });

  test("学部変更で後続ステップがクリアされる", async ({ page }) => {
    await page.getByRole("button", { name: "情報学部" }).click();
    await page.getByRole("button", { name: "情報科学科" }).click();
    await expect(page.getByRole("button", { name: "1年" })).toBeVisible();

    await page.getByRole("button", { name: "工学部" }).click();

    await expect(page.getByRole("button", { name: "1年" })).toBeHidden();
    await expect(page.getByRole("button", { name: "機械工学科" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S4: 日時精度の切り替え
// ---------------------------------------------------------------------------

test.describe("S4: 日時精度切り替え", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/new");
  });

  test("精度ボタンで入力タイプが切り替わる", async ({ page }) => {
    const sec = section(page, "相談日時");

    await expect(sec.locator("input[type='datetime-local']")).toBeVisible();

    await page.getByRole("button", { name: "日付のみ" }).click();
    await expect(sec.locator("input[type='date']")).toBeVisible();
    await expect(sec.locator("input[type='datetime-local']")).toBeHidden();

    await page.getByRole("button", { name: "年月のみ" }).click();
    await expect(sec.locator("input[type='month']")).toBeVisible();

    await page.getByRole("button", { name: "年のみ" }).click();
    await expect(sec.locator("input[type='number']")).toBeVisible();
  });

  test("精度変更で入力値がクリアされる", async ({ page }) => {
    const sec = section(page, "相談日時");

    const input = sec.locator("input[type='datetime-local']");
    await expect(input).not.toHaveValue("");

    await page.getByRole("button", { name: "日付のみ" }).click();
    const dateInput = sec.locator("input[type='date']");
    await expect(dateInput).toHaveValue("");
  });
});

// ---------------------------------------------------------------------------
// S5: 解決ステータス切替
// ---------------------------------------------------------------------------

test.describe("S5: 解決ステータス切替", () => {
  test("未解決→解決でフォローアップが非表示になる", async ({ page }) => {
    await page.goto("/new");

    const sec = resolutionSection(page);

    // 未解決を選択
    await sec.getByRole("button", { name: "未解決", exact: true }).click();
    await expect(sec.getByText("後処理")).toBeVisible();

    // フォローアップを選択
    await sec.getByRole("combobox").click();
    await page.getByRole("option", { name: "技術部" }).click();

    // 解決に戻す → フォローアップが消える
    await sec.getByRole("button", { name: "解決", exact: true }).click();
    await expect(sec.getByText("後処理")).toBeHidden();
  });
});
