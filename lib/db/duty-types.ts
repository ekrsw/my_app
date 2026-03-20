import { prisma } from "@/lib/prisma"

export async function getDutyTypes() {
  return prisma.dutyType.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

export async function getActiveDutyTypes() {
  return prisma.dutyType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}
