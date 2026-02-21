import { prisma } from "@/lib/prisma"

export async function getPositions() {
  return prisma.position.findMany({
    include: {
      _count: {
        select: {
          employeePositions: {
            where: { endDate: null },
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}

export async function getActivePositions() {
  return prisma.position.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  })
}
