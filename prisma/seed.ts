import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"
import bcrypt from "bcrypt"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD

  if (!username || !password) {
    console.error("ADMIN_USERNAME と ADMIN_PASSWORD を .env に設定してください")
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    console.log(`ユーザー "${username}" は既に存在します`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.user.create({
    data: { username, passwordHash },
  })

  console.log(`管理者ユーザー "${username}" を作成しました`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
