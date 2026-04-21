import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"
import { getTimeHHMM } from "@/lib/capacity-utils"
import type { DashboardOverviewFilter, DashboardFilterOptions } from "@/types"

/** EmployeeGroup 用 Prisma where 条件（startDate nullable） */
function currentGroupDateWhere(today: Date) {
  return {
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: today } }] },
      { OR: [{ endDate: null }, { endDate: { gte: today } }] },
    ],
  }
}

/** EmployeeFunctionRole 用 Prisma where 条件（startDate nullable） */
function currentRoleDateWhere(today: Date) {
  return {
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: today } }] },
      { OR: [{ endDate: null }, { endDate: { gte: today } }] },
    ],
  }
}

/**
 * DB から distinct role_type を取得して動的にカラムマッピング（getShiftsForDaily と同じロジック）
 * roleTypes[0] = 監督系 (権限), roleTypes[1] = 業務系 (職務)
 * ASC ソートにより roleType の昇順で取得（権限 < 職務）
 */
async function getRoleTypes(): Promise<[string, string]> {
  const distinctTypes = await prisma.functionRole.findMany({
    select: { roleType: true },
    distinct: ["roleType"],
    orderBy: { roleType: "asc" },
  })
  return [
    distinctTypes[0]?.roleType ?? "権限",
    distinctTypes[1]?.roleType ?? "職務",
  ]
}

/**
 * フィルター条件から従業員の Prisma where 句を構築する共通ヘルパー。
 * getDailyOverview / getPreviousDayOvernightShifts で共有。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildEmployeeFilterWhere(filter: DashboardOverviewFilter, date: Date): Promise<any> {
  const roleTypes = await getRoleTypes()
  const groupDateFilter = currentGroupDateWhere(date)
  const roleDateFilter = currentRoleDateWhere(date)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {
    AND: [
      {
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: date } },
        ],
      },
    ],
  }

  // グループフィルター
  const groupConditions = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    groupConditions.push({ groups: { some: { groupId: { in: filter.groupIds }, ...groupDateFilter } } })
  }
  if (filter.unassigned) {
    groupConditions.push({ groups: { none: groupDateFilter } })
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
            ...roleDateFilter,
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
            ...roleDateFilter,
            functionRole: {
              roleType: roleTypes[1],
              roleName: { in: filter.businessRoleNames },
            },
          },
        },
      },
    ]
  }

  return employeeWhere
}

/**
 * フィルター条件からシフトの Prisma where 句にシフト固有条件を追加する共通ヘルパー。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyShiftFilterWhere(shiftWhere: any, filter: DashboardOverviewFilter) {
  if (filter.shiftCodes && filter.shiftCodes.length > 0) {
    shiftWhere.shiftCode = { in: filter.shiftCodes }
  }
  if (filter.isRemote) {
    shiftWhere.isRemote = true
  }
}

export async function getDailyOverview(date: Date, filter: DashboardOverviewFilter = {}) {
  const employeeWhere = await buildEmployeeFilterWhere(filter, date)

  // シフトwhere句
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftWhere: any = {
    shiftDate: date,
    startTime: { not: null },
    isHoliday: { not: true },
  }

  applyShiftFilterWhere(shiftWhere, filter)

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
            where: currentGroupDateWhere(date),
          },
          functionRoles: {
            where: {
              OR: [
                { startDate: null, endDate: null },
                { startDate: null, endDate: { gte: date } },
                { startDate: { lte: date }, endDate: null },
                { startDate: { lte: date }, endDate: { gte: date } },
              ],
            },
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

export async function getDailyFilterOptions(date: Date): Promise<DashboardFilterOptions> {
  const roleTypes = await getRoleTypes()

  const dayShifts = await prisma.shift.findMany({
    where: {
      shiftDate: date,
      startTime: { not: null },
      isHoliday: { not: true },
      employee: {
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: date } },
        ],
      },
    },
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: currentGroupDateWhere(date),
          },
          functionRoles: {
            where: {
              OR: [
                { startDate: null, endDate: null },
                { startDate: null, endDate: { gte: date } },
                { startDate: { lte: date }, endDate: null },
                { startDate: { lte: date }, endDate: { gte: date } },
              ],
            },
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

  for (const shift of dayShifts) {
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
      employee: {
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: today } },
        ],
      },
    },
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: currentGroupDateWhere(today),
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
      shiftDate: {
        gte: todayStart,
        lt: tomorrowStart,
      },
    },
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: {
              startDate: { lte: todayStart },
              OR: [{ endDate: null }, { endDate: { gte: todayStart } }],
            },
          },
        },
      },
    },
    orderBy: { changedAt: "desc" },
  })
}

/**
 * 指定日の前日の夜勤シフト（日跨ぎで当日も勤務中のもの）を取得する。
 * endTime の HH:mm が startTime の HH:mm より小さいシフトを夜勤とみなす。
 * ダッシュボードフィルター（SV・グループ・シフトコード等）にも対応。
 */
export async function getPreviousDayOvernightShifts(date: Date, filter: DashboardOverviewFilter = {}) {
  const previousDay = new Date(date.getTime() - 24 * 60 * 60 * 1000)
  const employeeWhere = await buildEmployeeFilterWhere(filter, date)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftWhere: any = {
    shiftDate: previousDay,
    startTime: { not: null },
    endTime: { not: null },
    isHoliday: { not: true },
  }

  applyShiftFilterWhere(shiftWhere, filter)

  if (Object.keys(employeeWhere).length > 0) {
    shiftWhere.employee = employeeWhere
  }

  const previousDayShifts = await prisma.shift.findMany({
    where: shiftWhere,
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: currentGroupDateWhere(date),
          },
          functionRoles: {
            where: currentRoleDateWhere(date),
            include: { functionRole: true },
          },
        },
      },
    },
  })

  // endTime < startTime のシフトのみ返す（日跨ぎ夜勤）
  return previousDayShifts.filter((s) => {
    if (!s.startTime || !s.endTime) return false
    return getTimeHHMM(s.startTime) > getTimeHHMM(s.endTime)
  })
}
