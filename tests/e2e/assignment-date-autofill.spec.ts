import { test, expect, type Page } from "@playwright/test"

// 入社日・退職日からの所属開始日/終了日 自動補完の E2E。
// 設計: ~/.gstack/projects/ekrsw-my_app/ekoresawa-main-design-20260616-171556.md
//
// 注意: Playwright は dev DB（.env の DATABASE_URL）に対して走り、tests/ の
// cleanupDatabase() は使えない。よって本 spec は専用プレフィックス付きの
// フィクスチャ（グループ1 + 従業員2）を UI で作成し、afterAll で UI から削除して
// dev DB を汚さない。サーバーロジック自体の網羅は tests/actions の実DB統合テスト。
//
// auth: playwright.config の setup プロジェクトが storageState を注入（ログイン済み）。

const PREFIX = `ZZ_E2E_AUTOFILL_${Date.now()}`
const GROUP = `${PREFIX}_G`
const EMP_CREATE = `${PREFIX}_CREATE` // 作成時補完
const EMP_RETRO = `${PREFIX}_RETRO` // 遡及補完（入社日・退職日）
const HIRE = "2025-04-01"
const HIRE_DISPLAY = "2025/04/01"
const TERM = "2025-10-01"
const TERM_DISPLAY = "2025/10/01"

const DETAIL_URL = /\/top\/employees\/[0-9a-f-]{36}$/

// 一覧はページネーション + 名前検索。フィクスチャ名は接頭辞でソート末尾に来るため、
// 必ず検索で絞り込んでから行をクリックする。行クリックは router.push（ハイドレーション
// 競合で初回が取りこぼされることがある）なので遷移成立まで再試行する。
async function findEmployeeRow(page: Page, name: string) {
  // URL の search パラメータでサーバー側フィルタ（クライアント検索欄の Suspense/debounce 回避）。
  // activeOnly=false で退職日入りの従業員も表示対象にする。
  await page.goto(`/top/employees?search=${encodeURIComponent(name)}&activeOnly=false`)
  const row = page.getByRole("row").filter({ hasText: name }).first()
  await expect(row).toBeVisible()
  return row
}

async function openEmployeeDetail(page: Page, name: string) {
  const row = await findEmployeeRow(page, name)
  await expect(async () => {
    await row.click()
    await expect(page).toHaveURL(DETAIL_URL, { timeout: 1000 })
  }).toPass({ timeout: 10_000 })
  await expect(page.getByRole("tab", { name: "所属" })).toBeVisible()
}

async function selectRadixOption(page: Page, triggerText: string, optionName: string) {
  await page.getByText(triggerText, { exact: true }).click()
  await page.getByRole("option", { name: optionName }).click()
}

async function createEmployeeViaDialog(
  page: Page,
  name: string,
  opts: { hireDate?: string; group?: string } = {},
) {
  await page.goto("/top/employees")
  await page.getByRole("button", { name: "新規作成" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("氏名 *").fill(name)
  if (opts.group) {
    await dialog.getByText("グループを選択", { exact: true }).click()
    await page.getByRole("option", { name: opts.group }).click()
  }
  if (opts.hireDate) {
    await dialog.locator("#hireDate").fill(opts.hireDate)
  }
  await dialog.getByRole("button", { name: "保存" }).click()
  await expect(dialog).toBeHidden()
}

test.describe.configure({ mode: "serial" })

test.describe("入社日・退職日からの期間自動補完", () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    // フィクスチャ用グループを作成
    await page.goto("/top/groups")
    await page.getByRole("button", { name: "新規作成" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel(/グループ名/).fill(GROUP)
    await dialog.getByRole("button", { name: "保存" }).click()
    await expect(dialog).toBeHidden()
    await page.close()
  })

  test("1. 作成時補完: 入社日ありの従業員に開始日空欄で所属追加 → 開始日に入社日", async ({ page }) => {
    await createEmployeeViaDialog(page, EMP_CREATE, { hireDate: HIRE })
    await openEmployeeDetail(page, EMP_CREATE)

    await page.getByRole("tab", { name: "所属" }).click()
    await page.getByRole("button", { name: "グループを追加" }).click()
    await selectRadixOption(page, "グループを選択", GROUP)
    // 開始日は空欄のまま保存
    await page.getByRole("button", { name: "保存" }).click()

    const row = page.getByRole("row").filter({ hasText: GROUP })
    await expect(row).toContainText(HIRE_DISPLAY)
  })

  test("2. 遡及補完(入社日): 後から入社日を入れると空欄開始日が埋まる", async ({ page }) => {
    // 入社日なし + グループ指定で作成 → 開始日は空欄(-)
    await createEmployeeViaDialog(page, EMP_RETRO, { group: GROUP })
    await openEmployeeDetail(page, EMP_RETRO)

    await page.getByRole("tab", { name: "所属" }).click()
    const row = page.getByRole("row").filter({ hasText: GROUP })
    await expect(row).toBeVisible()

    // 基本情報タブで入社日を後入力
    await page.getByRole("tab", { name: "基本情報" }).click()
    await page.getByRole("button", { name: "編集" }).click()
    await page.locator("#edit-hireDate").fill(HIRE)
    await page.getByRole("button", { name: "保存" }).click()

    // 所属タブに戻ると開始日が入社日で埋まっている
    await page.getByRole("tab", { name: "所属" }).click()
    await expect(page.getByRole("row").filter({ hasText: GROUP })).toContainText(HIRE_DISPLAY)
  })

  test("3. 遡及補完(退職日): 退職日を入れると空欄終了日が埋まる", async ({ page }) => {
    await openEmployeeDetail(page, EMP_RETRO)

    await page.getByRole("tab", { name: "基本情報" }).click()
    await page.getByRole("button", { name: "編集" }).click()
    await page.locator("#edit-terminationDate").fill(TERM)
    await page.getByRole("button", { name: "保存" }).click()

    await page.getByRole("tab", { name: "所属" }).click()
    await expect(page.getByRole("row").filter({ hasText: GROUP })).toContainText(TERM_DISPLAY)
  })

  test.afterAll(async ({ browser }) => {
    test.setTimeout(90_000)
    const page = await browser.newPage()
    const T = { timeout: 5000 } // 各操作を短く区切り、afterAll が詰まらないようにする

    // 従業員を削除（詳細ページ基本情報タブの削除ボタン）
    for (const name of [EMP_CREATE, EMP_RETRO]) {
      try {
        await page.goto(`/top/employees?search=${encodeURIComponent(name)}&activeOnly=false`)
        const row = page.getByRole("row").filter({ hasText: name }).first()
        if (!(await row.isVisible(T).catch(() => false))) continue
        await expect(async () => {
          await row.click(T)
          await expect(page).toHaveURL(DETAIL_URL, { timeout: 1000 })
        }).toPass({ timeout: 8000 })
        await page.getByRole("button", { name: "削除" }).click(T)
        await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click(T)
        await expect(page.getByRole("alertdialog")).toBeHidden(T)
      } catch {
        // ベストエフォート（残った場合は手動削除）
      }
    }
    // グループを削除（行の編集ボタン→編集ダイアログ内の削除→確認）
    try {
      await page.goto("/top/groups")
      const grow = page.getByRole("row").filter({ hasText: GROUP }).first()
      if (await grow.isVisible(T).catch(() => false)) {
        await grow.getByRole("button").first().click(T)
        const dialog = page.getByRole("dialog")
        await dialog.getByRole("button", { name: "削除" }).click(T)
        await page.getByRole("alertdialog").getByRole("button", { name: "削除" }).click(T)
        await expect(page.getByRole("alertdialog")).toBeHidden(T)
      }
    } catch {
      // ベストエフォート（残ったグループは手動削除）
    }
    await page.close()
  })
})
