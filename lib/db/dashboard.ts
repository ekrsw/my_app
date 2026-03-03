import { prisma } from "@/lib/prisma"

export async function getDashboardStats() {
  // @db.Date カラムとの比較は UTC 基準のため、ローカル日付を UTC midnight に変換
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

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
  // @db.Date カラムとの比較は UTC 基準のため、ローカル日付を UTC midnight に変換
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

  return prisma.shift.findMany({
    where: { shiftDate: today },
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
