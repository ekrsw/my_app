import { prisma } from "@/lib/prisma"

export async function getGroups() {
  return prisma.group.findMany({
    include: {
      _count: {
        select: {
          employeeGroups: {
            where: { endDate: null },
          },
        },
      },
    },
    orderBy: { id: "asc" },
  })
}

export async function getGroupById(id: number) {
  return prisma.group.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          employeeGroups: {
            where: { endDate: null },
          },
        },
      },
    },
  })
}
