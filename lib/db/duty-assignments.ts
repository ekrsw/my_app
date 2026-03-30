import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"

export async function getTodayDutyAssignments() {
  const today = getTodayJST()

  return prisma.dutyAssignment.findMany({
    where: { dutyDate: today },
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: {
              AND: [
                { OR: [{ startDate: null }, { startDate: { lte: today } }] },
                { OR: [{ endDate: null }, { endDate: { gte: today } }] },
              ],
            },
          },
        },
      },
      dutyType: true,
    },
    orderBy: [{ startTime: "asc" }, { employee: { name: "asc" } }],
  })
}

export async function getDutyAssignmentsByDate(date: Date | null) {
  return prisma.dutyAssignment.findMany({
    where: date ? { dutyDate: date } : undefined,
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: { endDate: null },
          },
        },
      },
      dutyType: true,
    },
    orderBy: [{ dutyType: { sortOrder: "asc" } }, { dutyDate: "asc" }, { startTime: "asc" }, { employee: { name: "asc" } }],
  })
}
