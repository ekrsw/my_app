import { defineConfig } from "vitest/config"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true })

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // JST 前提のアプリのため、テスト実行 TZ を固定する。
    // これにより日付境界のロジック（asUTC 経由の formatDate 等）が
    // 実行環境（開発機 JST / CI UTC）に依存せず決定的にテストされる。
    env: { TZ: "Asia/Tokyo" },
    setupFiles: ["./tests/setup.ts", "./tests/components/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    server: {
      deps: {
        inline: ["next-auth"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
