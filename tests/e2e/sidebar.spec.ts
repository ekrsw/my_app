import { test, expect } from "@playwright/test"

// NOTE (route-restructure-auth-gate / design-20260615):
// アプリは /top 配下へ移設され、全ページが認証必須になった（未認証は /login へ）。
// 本 spec は未認証（clearCookies）で `/` を開きサイドバーを操作する前提だったが、
// `/` は工事中ページ（サイドバー無し）になり、`/top` も認証が要る。
// 認証コンテキスト（storageState 等）を用意するまで通らないため skip。
// パス・URL アサーションは新構成（/top/*）へ更新済み。
// 認証フィクスチャ整備は「Playwright E2E を CI 統合」TODO + 「認証動線 E2E」TODO で対応。
test.describe.skip("Sidebar — desktop (md 以上)（要・認証コンテキスト）", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test("1. smoke — ページがロードされ AppSidebar が存在する", async ({ page }) => {
    await page.goto("/top")
    await expect(page.getByRole("link", { name: /CSC管理ツール/ })).toBeVisible()
  })

  test("2. SidebarTrigger(ヘッダー右端)で開→閉、Headsetクリックで閉→開", async ({ page }) => {
    await page.goto("/top")

    const brandLink = page.getByRole("link", { name: /CSC管理ツール/ })
    await expect(brandLink).toBeVisible()

    const closeButton = page.getByRole("button", { name: "サイドバーを閉じる" })
    await expect(closeButton).toBeVisible()
    await closeButton.click()

    await expect(brandLink).toBeHidden()
    const openButton = page.getByRole("button", { name: "サイドバーを開く" })
    await expect(openButton).toBeVisible()

    await openButton.click()
    await expect(brandLink).toBeVisible()
  })

  test("3. ホバー swap — 閉じた状態で Headset にホバーすると PanelLeftIcon に入れ替わる", async ({ page }) => {
    await page.goto("/top")

    await page.getByRole("button", { name: "サイドバーを閉じる" }).click()

    const openButton = page.getByRole("button", { name: "サイドバーを開く" })
    await expect(openButton).toBeVisible()

    const headset = openButton.locator("svg.lucide-headset").first()
    const panelLeft = openButton.locator("svg.lucide-panel-left").first()

    await expect(headset).toBeVisible()
    await expect(panelLeft).toBeHidden()

    await openButton.hover()

    await expect(headset).toBeHidden()
    await expect(panelLeft).toBeVisible()
  })

  test("4. 設定メニュー expanded — Collapsible 展開 → 7 項目 → /top/groups 遷移", async ({ page }) => {
    await page.goto("/top")

    await page.getByRole("button", { name: "設定" }).click()

    await expect(page.getByRole("link", { name: "グループ" })).toBeVisible()
    await expect(page.getByRole("link", { name: "ロール" })).toBeVisible()
    await expect(page.getByRole("link", { name: "役職" })).toBeVisible()
    await expect(page.getByRole("link", { name: "シフトコード" })).toBeVisible()
    await expect(page.getByRole("link", { name: "業務種別" })).toBeVisible()
    await expect(page.getByRole("link", { name: "データ" })).toBeVisible()
    await expect(page.getByRole("link", { name: "ヘルプ" })).toBeVisible()

    await page.getByRole("link", { name: "グループ" }).click()
    await expect(page).toHaveURL(/\/top\/groups/)
  })

  test("5. CRITICAL REGRESSION — 設定メニュー collapsed は DropdownMenu で 7 項目が見え遷移できる", async ({ page }) => {
    await page.goto("/top")

    await page.getByRole("button", { name: "サイドバーを閉じる" }).click()
    await expect(page.getByRole("button", { name: "サイドバーを開く" })).toBeVisible()

    await page.getByRole("button", { name: "設定" }).click()

    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /グループ/ })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /ロール/ })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /役職/ })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /シフトコード/ })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /業務種別/ })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /データ/ })).toBeVisible()
    await expect(menu.getByRole("menuitem", { name: /ヘルプ/ })).toBeVisible()

    await menu.getByRole("menuitem", { name: /ロール/ }).click()
    await expect(page).toHaveURL(/\/top\/roles/)
  })

  test("7. cookie 永続化 — 閉じた状態でリロードしても閉じたまま起動する(SSR flash 無し)", async ({ page }) => {
    await page.goto("/top")
    await page.getByRole("button", { name: "サイドバーを閉じる" }).click()
    await expect(page.getByRole("button", { name: "サイドバーを開く" })).toBeVisible()

    await page.reload()

    const brandLink = page.getByRole("link", { name: /CSC管理ツール/ })
    const openButton = page.getByRole("button", { name: "サイドバーを開く" })
    await expect(openButton).toBeVisible()
    await expect(brandLink).toBeHidden()
  })
})

test.describe.skip("Sidebar — mobile (md 未満)（要・認証コンテキスト）", () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test.beforeEach(async ({ context }) => {
    await context.clearCookies()
  })

  test("6. モバイル — ページヘッダーのトリガーで sheet が開き、メニュー遷移で閉じる", async ({ page }) => {
    await page.goto("/top")

    const trigger = page.getByRole("button", { name: /toggle sidebar/i })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const brandLink = page.getByRole("link", { name: /CSC管理ツール/ })
    await expect(brandLink).toBeVisible()

    await page.getByRole("link", { name: "シフト変更履歴" }).click()
    await expect(page).toHaveURL(/\/top\/shifts\/history/)
  })
})
