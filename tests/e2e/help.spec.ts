import { test, expect } from "@playwright/test"

// NOTE (route-restructure-auth-gate / design-20260615):
// 全ページが認証必須になり、未認証アクセスは /login へリダイレクトされる。
// 本 spec は未認証（clearCookies）前提で書かれているため、認証コンテキスト
// （storageState 等）を用意するまで通らない。パスは新構成（/top/*）へ更新済み。
// 認証フィクスチャ整備は「Playwright E2E を CI 統合」TODO + 「認証動線 E2E」TODO で対応。
test.describe.skip("ヘルプページと各画面からの導線（要・認証コンテキスト）", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test("1. /top/help がロードされ 5 セクションが表示される", async ({ page }) => {
    await page.goto("/top/help")
    await expect(page.getByRole("heading", { name: "ヘルプ", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "業務種別の追加" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "業務割当ての追加" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "シフトの変更" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "変更履歴の操作" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "バックアップとリストア" })).toBeVisible()
  })

  test("2. 目次リンクで同一ページ内の該当セクションへ移動する", async ({ page }) => {
    await page.goto("/top/help")
    await page
      .getByRole("navigation", { name: "目次" })
      .getByRole("link", { name: "変更履歴の操作" })
      .click()
    await expect(page).toHaveURL(/\/top\/help#history$/)
    await expect(page.locator("section#history").first()).toBeInViewport()
  })

  test("3. 業務種別画面の「?」→ /top/help#duty-types", async ({ page }) => {
    await page.goto("/top/duty-types")
    await page.locator("header").getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/top\/help#duty-types$/)
    await expect(page.locator("section#duty-types")).toBeInViewport()
  })

  test("4. 業務管理画面の「?」→ /top/help#duty-assign", async ({ page }) => {
    await page.goto("/top/duty-assignments")
    await page.locator("header").getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/top\/help#duty-assign$/)
    await expect(page.locator("section#duty-assign")).toBeInViewport()
  })

  test("5. シフト変更履歴画面の「?」→ /top/help#history", async ({ page }) => {
    await page.goto("/top/shifts/history")
    await page.locator("header").getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/top\/help#history$/)
    await expect(page.locator("section#history")).toBeInViewport()
  })

  test("6. サイドバー設定 → ヘルプ で /top/help へ遷移する", async ({ page }) => {
    await page.goto("/top")
    await page.getByRole("button", { name: "設定" }).click()
    await page.getByRole("link", { name: "ヘルプ" }).click()
    await expect(page).toHaveURL(/\/top\/help$/)
    await expect(page.getByRole("heading", { name: "ヘルプ", level: 1 })).toBeVisible()
  })
})
