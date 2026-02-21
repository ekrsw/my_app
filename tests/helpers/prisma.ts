import { PrismaClient } from "@/app/generated/prisma/client"

const testDatabaseUrl = process.env.DATABASE_URL

if (!testDatabaseUrl || !testDatabaseUrl.includes("_test")) {
  throw new Error(
    "Tests must use a test database (DATABASE_URL must contain '_test'). " +
      "Ensure .env.test is loaded before running tests."
  )
}

export const prisma = new PrismaClient({
  datasourceUrl: testDatabaseUrl,
})
