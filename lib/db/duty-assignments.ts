import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"
import { getTimeHHMM } from "@/lib/capacity-utils"

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

/**
 * 前日の深夜跨ぎ業務割当（日跨ぎで現在も継続中のもの）を取得する。
 * endTime の HH:mm が startTime の HH:mm より小さい割当を深夜跨ぎとみなす。
 */
export async function getYesterdayOvernightDutyAssignments() {
  const today = getTodayJST()
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

  const yesterdayDuties = await prisma.dutyAssignment.findMany({
    where: { dutyDate: yesterday },
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
  })

  return yesterdayDuties.filter((d) => {
    return getTimeHHMM(d.startTime) > getTimeHHMM(d.endTime)
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
