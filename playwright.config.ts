import { defineConfig, devices } from "@playwright/test"

// 認証付き E2E 用の storageState 保存先（単一ソース）。auth.setup.ts も同じ定数を使う。
import {
  STORAGE_STATE,
  EXPIRY_TTL_SECONDS,
  EXPIRY_PORT,
  EXPIRY_BASE_URL,
} from "./tests/e2e/constants"

// 社内プロキシ(HTTP_PROXY)が localhost までトンネルする環境では、
// webServer への接続がタイムアウトする。NO_PROXY に localhost を含めて自動バイパス。
// ユーザーが NO_PROXY を既に指定している場合は尊重する。
const NO_PROXY_LOCAL = ["localhost", "127.0.0.1", "::1"]
const existing = (process.env.NO_PROXY ?? process.env.no_proxy ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
const merged = Array.from(new Set([...existing, ...NO_PROXY_LOCAL])).join(",")
process.env.NO_PROXY = merged
process.env.no_proxy = merged

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 認証セットアップ：/login でログインし storageState を保存する。
    // 以降の認証必須プロジェクトはこれに依存し、ログイン済み状態で起動する。
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /desktop\.spec\.ts|sidebar\.spec\.ts|help\.spec\.ts/,
      grep: /Sidebar — desktop|ヘルプページと各画面からの導線/,
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"], storageState: STORAGE_STATE },
      dependencies: ["setup"],
      testMatch: /mobile\.spec\.ts|sidebar\.spec\.ts/,
      grep: /Sidebar — mobile/,
    },
    // セッション絶対期限のスモーク。spec 内でログインするため setup 非依存・
    // storageState 無し。短期限を効かせた専用サーバー（EXPIRY_PORT）を向く。
    // これにより `npm run test:all` / `npm run test:e2e` 一発で他 E2E と一緒に走る
    //（短期限 env は専用サーバーにのみ適用され、3000 の通常サーバーは影響を受けない）。
    {
      name: "chromium-expiry",
      use: { ...devices["Desktop Chrome"], baseURL: EXPIRY_BASE_URL },
      testMatch: /session-expiry\.spec\.ts/,
      grep: /セッション絶対期限と再ログイン動線/,
    },
  ],
  // 通常サーバー（3000）と、短期限を効かせた専用サーバー（EXPIRY_PORT）の2本を立てる。
  // 短期限 env は専用サーバーの webServer.env にのみ設定し、通常サーバーと混ざらない。
  webServer: [
    {
      command: "npm run start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npm run start -- --port ${EXPIRY_PORT}`,
      url: EXPIRY_BASE_URL,
      // 専用サーバーは必ず自前で起動する（既存サーバーを誤って流用すると短期限 env が
      // 効かず失効テストが偽陰性になるため）。ポート使用中なら明確に失敗させる。
      reuseExistingServer: false,
      timeout: 180_000,
      env: { AUTH_ABSOLUTE_SESSION_SECONDS: String(EXPIRY_TTL_SECONDS) },
    },
  ],
})
