import { defineConfig } from "vitest/config"
import path from "path"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true })

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
