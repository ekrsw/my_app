import { defineConfig, devices } from "@playwright/test"

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
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /desktop\.spec\.ts|sidebar\.spec\.ts/,
      grep: /Sidebar — desktop/,
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: /mobile\.spec\.ts|sidebar\.spec\.ts/,
      grep: /Sidebar — mobile/,
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
