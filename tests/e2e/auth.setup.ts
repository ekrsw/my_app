import { test as setup, expect } from "@playwright/test"
import path from "node:path"
import dotenv from "dotenv"
import { STORAGE_STATE } from "./constants"

// 認証付き E2E のための storageState セットアップ。
//
// playwright.config.ts の webServer は `npm run start`（本番ビルド）を
// `.env` で起動するため、ログイン資格情報も `.env` の
// ADMIN_USERNAME / ADMIN_PASSWORD を使う（テスト用 .env.test ではない）。
// 事前に `npm run db:seed` で admin ユーザーが投入されている必要がある。
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

setup("authenticate", async ({ page }) => {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error(
      "ADMIN_USERNAME / ADMIN_PASSWORD が .env に未設定です。E2E 認証フィクスチャを作成できません",
    )
  }

  await page.goto("/login")
  await page.getByLabel("ユーザー名").fill(username)
  await page.getByLabel("パスワード").fill(password)
  await page.getByRole("button", { name: "ログイン" }).click()

  // ログイン成功で /top へ遷移し、サイドバーのブランドリンクが見えること
  await page.waitForURL(/\/top/)
  await expect(page.getByRole("link", { name: /CSC管理ツール/ })).toBeVisible()

  await page.context().storageState({ path: STORAGE_STATE })
})
