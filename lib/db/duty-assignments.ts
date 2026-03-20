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
            where: { endDate: null },
          },
        },
      },
      dutyType: true,
    },
    orderBy: [{ startTime: "asc" }, { employee: { name: "asc" } }],
  })
}

export async function getDutyAssignmentsByDate(date: Date) {
  return prisma.dutyAssignment.findMany({
    where: { dutyDate: date },
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
    orderBy: [{ dutyType: { sortOrder: "asc" } }, { startTime: "asc" }, { employee: { name: "asc" } }],
  })
}
