import { test, expect, type Locator, type Page } from "@playwright/test"

// NOTE (route-restructure-auth-gate / design-20260615):
// 全ページが認証必須になり、未認証アクセスは /login へリダイレクトされる。
// 認証コンテキストは tests/e2e/auth.setup.ts が storageState を保存し、
// playwright.config.ts の setup プロジェクト依存でログイン済み状態を注入する。
// したがって clearCookies はしない（認証 Cookie を消すとリダイレクトされる）。

/**
 * Next.js App Router のハイドレーション競合対策。
 * ページ表示直後の最初のクリックは、リンク（next/link）のハイドレーション完了前だと
 * 取りこぼされ遷移しないことがある（特に設定サブメニューが自動展開する設定ページで
 * 顕著）。人間の操作速度では起きないが Playwright は表示直後にクリックするため、
 * ナビゲーション成立まで短間隔でクリックを再試行する。
 * 初回クリックで遷移できた場合は再クリックされない（toPass の本体が即パスするため）。
 */
async function clickUntilNavigated(
  page: Page,
  link: Locator,
  urlPattern: RegExp,
) {
  await expect(async () => {
    await link.click()
    await expect(page).toHaveURL(urlPattern, { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
}

test.describe("ヘルプページと各画面からの導線", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

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
    const helpLink = page.locator("header").getByRole("link", { name: "ヘルプ" })
    await clickUntilNavigated(page, helpLink, /\/top\/help#duty-types$/)
    await expect(page.locator("section#duty-types")).toBeInViewport()
  })

  test("4. 業務管理画面の「?」→ /top/help#duty-assign", async ({ page }) => {
    await page.goto("/top/duty-assignments")
    const helpLink = page.locator("header").getByRole("link", { name: "ヘルプ" })
    await clickUntilNavigated(page, helpLink, /\/top\/help#duty-assign$/)
    await expect(page.locator("section#duty-assign")).toBeInViewport()
  })

  test("5. シフト変更履歴画面の「?」→ /top/help#history", async ({ page }) => {
    await page.goto("/top/shifts/history")
    const helpLink = page.locator("header").getByRole("link", { name: "ヘルプ" })
    await clickUntilNavigated(page, helpLink, /\/top\/help#history$/)
    await expect(page.locator("section#history")).toBeInViewport()
  })

  test("6. サイドバー設定 → ヘルプ で /top/help へ遷移する", async ({ page }) => {
    await page.goto("/top")
    await page.getByRole("button", { name: "設定" }).click()
    const helpLink = page.getByRole("link", { name: "ヘルプ" })
    await clickUntilNavigated(page, helpLink, /\/top\/help$/)
    await expect(page.getByRole("heading", { name: "ヘルプ", level: 1 })).toBeVisible()
  })
})
