import { PrismaClient } from "@/app/generated/prisma/client"
import { withEncryption } from "@/lib/crypto/prisma-encryption"

const testDatabaseUrl = process.env.DATABASE_URL

if (!testDatabaseUrl || !testDatabaseUrl.includes("_test")) {
  throw new Error(
    "Tests must use a test database (DATABASE_URL must contain '_test'). " +
      "Ensure .env.test is loaded before running tests."
  )
}

// 本番と同じ透過暗号化拡張を適用し、統合テスト・サーバーアクションテストでも暗号化を効かせる。
export const prisma = withEncryption(
  new PrismaClient({
    datasourceUrl: testDatabaseUrl,
  })
)
