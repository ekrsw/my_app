import { test, expect } from "@playwright/test"

test.describe("ヘルプページと各画面からの導線", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test("1. /help がロードされ 5 セクションが表示される", async ({ page }) => {
    await page.goto("/help")
    await expect(page.getByRole("heading", { name: "ヘルプ", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "業務種別の追加" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "業務割当ての追加" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "シフトの変更" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "変更履歴の操作" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "バックアップとリストア" })).toBeVisible()
  })

  test("2. 目次リンクで同一ページ内の該当セクションへ移動する", async ({ page }) => {
    await page.goto("/help")
    await page
      .getByRole("navigation", { name: "目次" })
      .getByRole("link", { name: "変更履歴の操作" })
      .click()
    await expect(page).toHaveURL(/\/help#history$/)
    // 同一ルート内のハッシュ遷移は Next.js のソフトナビゲーションとして扱われ、
    // RSC 再フェッチ中の React トランジションで section#history が一時的に二重マウント
    // されることがある。strict ロケータだと一致が2件になり strict mode violation で落ちる。
    // .first() で strict 判定を回避し、toBeInViewport の自動リトライで DOM 安定後に判定する。
    await expect(page.locator("section#history").first()).toBeInViewport()
  })

  test("3. 業務種別画面の「?」→ /help#duty-types", async ({ page }) => {
    await page.goto("/duty-types")
    await page.locator("header").getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/help#duty-types$/)
    await expect(page.locator("section#duty-types")).toBeInViewport()
  })

  test("4. 業務管理画面の「?」→ /help#duty-assign", async ({ page }) => {
    await page.goto("/duty-assignments")
    await page.locator("header").getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/help#duty-assign$/)
    await expect(page.locator("section#duty-assign")).toBeInViewport()
  })

  test("5. シフト変更履歴画面の「?」→ /help#history", async ({ page }) => {
    await page.goto("/shifts/history")
    await page.locator("header").getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/help#history$/)
    await expect(page.locator("section#history")).toBeInViewport()
  })

  test("6. サイドバー設定 → ヘルプ で /help へ遷移する", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "設定" }).click()
    await page.getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/help$/)
    await expect(page.getByRole("heading", { name: "ヘルプ", level: 1 })).toBeVisible()
  })
})
