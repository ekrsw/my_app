import { prisma } from "@/lib/prisma"

export async function getShiftCodes() {
  return prisma.shiftCode.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

export async function getActiveShiftCodes() {
  return prisma.shiftCode.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}
