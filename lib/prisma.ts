import { PrismaClient } from "@/app/generated/prisma/client"
import { withEncryption } from "@/lib/crypto/prisma-encryption"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ベースクライアントは dev の HMR をまたいで再利用（接続枯渇を防ぐ）。
// 透過暗号化拡張はモジュール評価ごとに適用する（ベースをラップするだけで安価）。
const base = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = base

export const prisma = withEncryption(base)
