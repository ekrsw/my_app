import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"
import type { DashboardOverviewFilter, DashboardFilterOptions } from "@/types"

/**
 * DB から distinct role_type を取得して動的にカラムマッピング（getShiftsForDaily と同じロジック）
 * roleTypes[0] = 監督系, roleTypes[1] = 業務系
 */
async function getRoleTypes(): Promise<[string, string]> {
  const distinctTypes = await prisma.functionRole.findMany({
    select: { roleType: true },
    distinct: ["roleType"],
    orderBy: { roleType: "desc" },
  })
  return [
    distinctTypes[0]?.roleType ?? "監督",
    distinctTypes[1]?.roleType ?? "業務",
  ]
}

export async function getTodayOverview(filter: DashboardOverviewFilter = {}) {
  const today = getTodayJST()
  const roleTypes = await getRoleTypes()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {}

  // グループフィルター
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

  // 従業員IDフィルター
  if (filter.employeeIds && filter.employeeIds.length > 0) {
    employeeWhere.id = { in: filter.employeeIds }
  }

  // 監督ロール名フィルター
  if (filter.supervisorRoleNames && filter.supervisorRoleNames.length > 0) {
    employeeWhere.AND = [
      ...(employeeWhere.AND ?? []),
      {
        functionRoles: {
          some: {
            endDate: null,
            functionRole: {
              roleType: roleTypes[0],
              roleName: { in: filter.supervisorRoleNames },
            },
          },
        },
      },
    ]
  }

  // 業務ロール名フィルター
  if (filter.businessRoleNames && filter.businessRoleNames.length > 0) {
    employeeWhere.AND = [
      ...(employeeWhere.AND ?? []),
      {
        functionRoles: {
          some: {
            endDate: null,
            functionRole: {
              roleType: roleTypes[1],
              roleName: { in: filter.businessRoleNames },
            },
          },
        },
      },
    ]
  }

  // シフトwhere句
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftWhere: any = {
    shiftDate: today,
    startTime: { not: null },
    isHoliday: { not: true },
  }

  if (filter.shiftCodes && filter.shiftCodes.length > 0) {
    shiftWhere.shiftCode = { in: filter.shiftCodes }
  }

  if (filter.isRemote) {
    shiftWhere.isRemote = true
  }

  if (Object.keys(employeeWhere).length > 0) {
    shiftWhere.employee = employeeWhere
  }

  return prisma.shift.findMany({
    where: shiftWhere,
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: { endDate: null },
          },
          functionRoles: {
            where: { endDate: null },
            include: { functionRole: true },
          },
        },
      },
    },
    orderBy: [
      { employee: { name: "asc" } },
    ],
  })
}

export async function getDashboardFilterOptions(): Promise<DashboardFilterOptions> {
  const today = getTodayJST()
  const roleTypes = await getRoleTypes()

  const todayShifts = await prisma.shift.findMany({
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
          functionRoles: {
            where: { endDate: null },
            include: { functionRole: true },
          },
        },
      },
    },
  })

  const employeeMap = new Map<string, string>()
  const groupMap = new Map<number, string>()
  const shiftCodeSet = new Set<string>()
  const supervisorRoleNameSet = new Set<string>()
  const businessRoleNameSet = new Set<string>()
  let hasUnassigned = false

  for (const shift of todayShifts) {
    if (shift.shiftCode) shiftCodeSet.add(shift.shiftCode)

    const emp = shift.employee
    if (!emp) continue

    employeeMap.set(emp.id, emp.name)

    if (emp.groups.length === 0) {
      hasUnassigned = true
    }
    for (const eg of emp.groups) {
      groupMap.set(eg.group.id, eg.group.name)
    }

    for (const efr of emp.functionRoles) {
      if (!efr.functionRole) continue
      if (efr.functionRole.roleType === roleTypes[0]) {
        supervisorRoleNameSet.add(efr.functionRole.roleName)
      } else if (efr.functionRole.roleType === roleTypes[1]) {
        businessRoleNameSet.add(efr.functionRole.roleName)
      }
    }
  }

  return {
    employees: Array.from(employeeMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    groups: Array.from(groupMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    shiftCodes: Array.from(shiftCodeSet).sort(),
    hasUnassigned,
    supervisorRoleNames: Array.from(supervisorRoleNameSet).sort((a, b) => a.localeCompare(b, "ja")),
    businessRoleNames: Array.from(businessRoleNameSet).sort((a, b) => a.localeCompare(b, "ja")),
  }
}

export async function getTodayRemoteWorkers() {
  const today = getTodayJST()

  return prisma.shift.findMany({
    where: {
      shiftDate: today,
      isRemote: true,
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

export async function getTodayShiftChangeHistory() {
  const todayStart = getTodayJST()
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  return prisma.shiftChangeHistory.findMany({
    where: {
      changedAt: {
        gte: todayStart,
        lt: tomorrowStart,
      },
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
    orderBy: { changedAt: "desc" },
  })
}
