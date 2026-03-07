import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"

export async function getDashboardStats() {
  const today = getTodayJST()

  const [
    totalEmployees,
    activeEmployees,
    totalGroups,
    todayShifts,
    todayRemote,
    recentChanges,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({
      where: {
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: today } },
        ],
      },
    }),
    prisma.group.count(),
    prisma.shift.count({
      where: {
        shiftDate: today,
        startTime: { not: null },
        isHoliday: { not: true },
      },
    }),
    prisma.shift.count({
      where: {
        shiftDate: today,
        isRemote: true,
      },
    }),
    prisma.shiftChangeHistory.findMany({
      take: 10,
      orderBy: { changedAt: "desc" },
      include: {
        employee: {
          include: {
            groups: {
              include: { group: true },
              where: { endDate: null },
            },
          },
        },
      },
    }),
  ])

  return {
    totalEmployees,
    activeEmployees,
    totalGroups,
    todayShifts,
    todayRemote,
    recentChanges,
  }
}

export async function getTodayOverview() {
  const today = getTodayJST()

  return prisma.shift.findMany({
    where: {
      shiftDate: today,
      startTime: { not: null },
      isHoliday: { not: true },
    },
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: { endDate: null },
          },
        },
      },
    },
    orderBy: [
      { employee: { name: "asc" } },
    ],
  })
}
