import { test, expect } from "@playwright/test"
import path from "node:path"
import dotenv from "dotenv"
import { EXPIRY_TTL_SECONDS } from "./constants"

// セッション絶対期限 → 再ログイン動線の E2E（ローカルスモーク）。
//
// playwright.config.ts の chromium-expiry プロジェクトが、短期限
// （AUTH_ABSOLUTE_SESSION_SECONDS=EXPIRY_TTL_SECONDS）を効かせた専用サーバー
// （EXPIRY_PORT）を baseURL に持つ。共有 storageState を使わず spec 内でログインする
// （短期限だと他 spec の storageState を壊すためサーバーごと分離している）。
//
// 実行（他 E2E と一緒に）:  npm run test:e2e  /  npm run test:all
// このプロジェクトだけ:     npx playwright test --project=chromium-expiry
//
// Playwright は CI 未統合のため当面ローカル実行のみ（TODOS の CI 統合に依存）。
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

test.describe("セッション絶対期限と再ログイン動線", () => {
  test("失効 → /login?reason=expired → 再ログイン → 元画面復帰", async ({ page }) => {
    const username = process.env.ADMIN_USERNAME
    const password = process.env.ADMIN_PASSWORD
    test.skip(!username || !password, "ADMIN_USERNAME / ADMIN_PASSWORD が .env に未設定")

    // 1) ログイン
    await page.goto("/login")
    await page.getByLabel("ユーザー名").fill(username!)
    await page.getByLabel("パスワード").fill(password!)
    await page.getByRole("button", { name: "ログイン" }).click()
    await page.waitForURL(/\/top/)

    // 2) 従業員一覧へ遷移（失効前の作業画面）
    await page.goto("/top/employees")
    await expect(page).toHaveURL(/\/top\/employees/)

    // 3) 絶対期限が切れるまで待つ（ttl + マージン）
    await page.waitForTimeout((EXPIRY_TTL_SECONDS + 1) * 1000)

    // 4) 失効後に保護ページへ遷移 → /login?reason=expired へ飛ばされ、失効メッセージ表示
    await page.goto("/top/employees")
    await expect(page).toHaveURL(/\/login\?.*reason=expired/)
    await expect(
      page.getByText("セッションの有効期限が切れました。再度ログインしてください。")
    ).toBeVisible()

    // 5) 再ログイン → callbackUrl で元の従業員一覧へ復帰
    await page.getByLabel("ユーザー名").fill(username!)
    await page.getByLabel("パスワード").fill(password!)
    await page.getByRole("button", { name: "ログイン" }).click()
    await expect(page).toHaveURL(/\/top\/employees/)
  })
})
