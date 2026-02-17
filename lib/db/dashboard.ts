import { prisma } from "@/lib/prisma"

export async function getDashboardStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    totalEmployees,
    activeEmployees,
    totalGroups,
    todayShifts,
    todayRemote,
    todayPaidLeave,
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
        isPaidLeave: { not: true },
      },
    }),
    prisma.shift.count({
      where: {
        shiftDate: today,
        isRemote: true,
      },
    }),
    prisma.shift.count({
      where: {
        shiftDate: today,
        isPaidLeave: true,
      },
    }),
    prisma.shiftChangeHistory.findMany({
      take: 10,
      orderBy: { changedAt: "desc" },
      include: {
        shift: {
          include: {
            employee: {
              include: { group: true },
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
    todayPaidLeave,
    recentChanges,
  }
}

export async function getTodayOverview() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return prisma.shift.findMany({
    where: { shiftDate: today },
    include: {
      employee: {
        include: { group: true },
      },
    },
    orderBy: [
      { employee: { groupId: "asc" } },
      { employee: { name: "asc" } },
    ],
  })
}
