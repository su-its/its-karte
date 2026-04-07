import { test, expect, type Page } from "@playwright/test";

test.use({ navigationTimeout: 60_000, actionTimeout: 10_000 });

/** SearchableMultiSelect で項目をクリック */
async function selectMultiItem(page: Page, placeholder: string, label: string) {
  const input = page.getByPlaceholder(placeholder);
  await input.fill(label);
  const container = page.locator("div", { has: input });
  await container
    .locator(".flex.flex-wrap.gap-1\\.5.max-h-40")
    .getByText(label, { exact: false })
    .first()
    .click();
  await input.clear();
}

// ---------------------------------------------------------------------------
// F5: カルテ一覧・詳細表示
// ---------------------------------------------------------------------------

test.describe("F5: カルテ一覧", () => {
  test("一覧ページが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "カルテ一覧" })).toBeVisible();
  });

  test("カルテ作成リンクが機能する", async ({ page }) => {
    await page.goto("/");
    await page.getByText("カルテ作成").click();
    await expect(page).toHaveURL("/new", { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "カルテ作成" })).toBeVisible();
  });

  test("カルテがある場合、行クリックで詳細パネルが開く", async ({ page }) => {
    // まずカルテを1件作成
    await page.goto("/new");
    await page.getByPlaceholder("例: 山田太郎").fill("一覧テスト用");
    await page.getByPlaceholder("例: 12345678").fill("12345678");

    await selectMultiItem(page, "カテゴリを検索...", "eduroam");

    await page.getByPlaceholder("例: ノートPC (Windows)").fill("テスト端末");
    await page.getByPlaceholder("相談者が抱えている問題の詳細を記入").fill("テスト問題");

    await selectMultiItem(page, "名前・学籍番号で検索...", "テスト太郎");

    await page.getByPlaceholder("実施した対応の詳細を記入").fill("テスト対応");
    await page.getByRole("spinbutton").fill("10");

    await page.getByRole("button", { name: "カルテを作成" }).click();
    await expect(page).toHaveURL("/", { timeout: 15_000 });

    // 一覧に表示されていることを確認
    await expect(page.getByText("一覧テスト用")).toBeVisible();

    // 行をクリック → 詳細パネルが開く
    await page.getByText("一覧テスト用").click();
    await expect(page.getByText("カルテ詳細")).toBeVisible();

    // 詳細パネルに値が表示されている
    await expect(page.locator("[role='dialog']").getByText("一覧テスト用")).toBeVisible();
  });
});
