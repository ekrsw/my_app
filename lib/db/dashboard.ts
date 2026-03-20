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
    todayDuties,
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
    prisma.dutyAssignment.count({
      where: { dutyDate: today },
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
    todayDuties,
    recentChanges,
  }
}

type TodayOverviewFilter = {
  groupIds?: number[]
  unassigned?: boolean
  roleIds?: number[]
  roleUnassigned?: boolean
}

export async function getTodayOverview(filter: TodayOverviewFilter = {}) {
  const today = getTodayJST()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {}

  const groupConditions = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    groupConditions.push({ groups: { some: { groupId: { in: filter.groupIds }, endDate: null } } })
  }
  if (filter.unassigned) {
    groupConditions.push({ groups: { none: { endDate: null } } })
  }
  if (groupConditions.length > 0) {
    employeeWhere.OR = groupConditions
  }

  const roleConditions = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    roleConditions.push({ functionRoles: { some: { functionRoleId: { in: filter.roleIds }, endDate: null } } })
  }
  if (filter.roleUnassigned) {
    roleConditions.push({ functionRoles: { none: { endDate: null } } })
  }
  if (roleConditions.length > 0) {
    employeeWhere.AND = [...(employeeWhere.AND ?? []), roleConditions.length === 1 ? roleConditions[0] : { OR: roleConditions }]
  }

  return prisma.shift.findMany({
    where: {
      shiftDate: today,
      startTime: { not: null },
      isHoliday: { not: true },
      ...(Object.keys(employeeWhere).length > 0 ? { employee: employeeWhere } : {}),
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
