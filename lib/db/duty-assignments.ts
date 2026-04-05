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

import type {
  DutyDailyFilterParams,
  DutyDailyPaginatedResult,
  DutyCalendarResult,
  DutyCalendarData,
  DutyCalendarCell,
  DutyDailyFilterOptions,
} from "@/types/duties"
import { Prisma } from "@/app/generated/prisma/client"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 日次ビュー用: フィルター+ページネーション付き業務割当取得 */
export async function getDutyAssignmentsForDaily(
  params: DutyDailyFilterParams,
  options: { cursor?: number; pageSize?: number } = {}
): Promise<DutyDailyPaginatedResult> {
  const cursor = options.cursor ?? 0
  const pageSize = options.pageSize ?? 50

  const dateStr = params.date.toISOString().substring(0, 10)
  const conditions: string[] = [`da.duty_date = $1::date`]
  const queryParams: (string | number | boolean)[] = [dateStr]
  let paramIndex = 2

  if (params.employeeIds && params.employeeIds.length > 0) {
    const safeIds = params.employeeIds.filter((id) => UUID_RE.test(id))
    if (safeIds.length > 0) {
      const placeholders = safeIds.map((_, i) => `$${paramIndex + i}::uuid`).join(",")
      conditions.push(`da.employee_id IN (${placeholders})`)
      queryParams.push(...safeIds)
      paramIndex += safeIds.length
    }
  }
  if (params.groupIds && params.groupIds.length > 0) {
    const safeIds = params.groupIds.map(Number).filter((n) => Number.isFinite(n))
    if (safeIds.length > 0) {
      const placeholders = safeIds.map((_, i) => `$${paramIndex + i}`).join(",")
      conditions.push(`EXISTS (SELECT 1 FROM employee_groups eg WHERE eg.employee_id = da.employee_id AND eg.group_id IN (${placeholders}) AND eg.end_date IS NULL)`)
      queryParams.push(...safeIds)
      paramIndex += safeIds.length
    }
  }
  if (params.dutyTypeIds && params.dutyTypeIds.length > 0) {
    const safeIds = params.dutyTypeIds.map(Number).filter((n) => Number.isFinite(n))
    if (safeIds.length > 0) {
      const placeholders = safeIds.map((_, i) => `$${paramIndex + i}`).join(",")
      conditions.push(`da.duty_type_id IN (${placeholders})`)
      queryParams.push(...safeIds)
      paramIndex += safeIds.length
    }
  }
  if (params.reducesCapacity !== null && params.reducesCapacity !== undefined) {
    conditions.push(`da.reduces_capacity = $${paramIndex}`)
    queryParams.push(params.reducesCapacity)
    paramIndex++
  }

  const whereClause = conditions.join(" AND ")

  // ソート（固定値のみ使用、ユーザー入力は補間しない）
  const sortField = params.sortBy ?? "startTime"
  const sortDir = params.sortOrder === "desc" ? "DESC" : "ASC"
  let orderByClause: string
  switch (sortField) {
    case "employeeName":
      orderByClause = `e.name ${sortDir}`
      break
    case "groupName":
      orderByClause = `MIN(g.name) ${sortDir} NULLS LAST`
      break
    case "dutyTypeName":
      orderByClause = `dt.sort_order ${sortDir}, dt.name ${sortDir}`
      break
    case "startTime":
    default:
      orderByClause = `da.start_time ${sortDir}, e.name ASC`
      break
  }

  const joinClause = `JOIN employees e ON da.employee_id = e.id
     JOIN duty_types dt ON da.duty_type_id = dt.id
     LEFT JOIN employee_groups eg ON eg.employee_id = e.id AND eg.end_date IS NULL
     LEFT JOIN groups g ON eg.group_id = g.id`

  // GROUP BY で LEFT JOIN による行膨張を排除
  const groupByClause = `da.id, e.id, e.name, dt.id, dt.sort_order, dt.name, da.start_time`

  // total は初回のみ
  const totalResult = cursor === 0
    ? await prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(DISTINCT da.id) as count FROM duty_assignments da ${joinClause} WHERE ${whereClause}`,
        ...queryParams
      )
    : null
  const total = totalResult ? Number(totalResult[0].count) : 0

  // IDリスト取得（GROUP BYで重複排除）
  const idRows = await prisma.$queryRawUnsafe<{ id: number }[]>(
    `SELECT da.id FROM duty_assignments da
     ${joinClause}
     WHERE ${whereClause}
     GROUP BY ${groupByClause}
     ORDER BY ${orderByClause}
     OFFSET ${cursor} LIMIT ${pageSize + 1}`,
    ...queryParams
  )

  const hasMore = idRows.length > pageSize
  const slicedIds = idRows.slice(0, pageSize).map((r) => r.id)

  if (slicedIds.length === 0) {
    return { data: [], total, hasMore: false, nextCursor: null }
  }

  const data = await prisma.dutyAssignment.findMany({
    where: { id: { in: slicedIds } },
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
  })

  // Raw SQLのORDER BY順を維持
  const idOrder = new Map(slicedIds.map((id, i) => [id, i]))
  data.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))

  return {
    data,
    total,
    hasMore,
    nextCursor: hasMore ? cursor + pageSize : null,
  }
}

/** 月次ビュー用: カレンダーデータ取得 */
export async function getDutyAssignmentsForCalendar(
  year: number,
  month: number,
  groupIds?: number[]
): Promise<DutyCalendarResult> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0)) // 月末日

  const whereCondition: Prisma.DutyAssignmentWhereInput = {
    dutyDate: { gte: startDate, lte: endDate },
    ...(groupIds && groupIds.length > 0
      ? {
          employee: {
            groups: {
              some: {
                groupId: { in: groupIds },
                endDate: null,
              },
            },
          },
        }
      : {}),
  }

  const assignments = await prisma.dutyAssignment.findMany({
    where: whereCondition,
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
    orderBy: [{ employee: { name: "asc" } }, { dutyDate: "asc" }, { startTime: "asc" }],
  })

  // 従業員×日のマトリクスに変換
  const employeeMap = new Map<string, DutyCalendarData>()
  const dutyTypeCountMap = new Map<string, { code: string; name: string; color: string | null; count: number }>()

  for (const a of assignments) {
    const empId = a.employeeId
    if (!employeeMap.has(empId)) {
      const groupName = a.employee.groups[0]?.group.name ?? null
      employeeMap.set(empId, {
        employeeId: empId,
        employeeName: a.employee.name,
        groupName,
        duties: {},
      })
    }

    const dateStr = (typeof a.dutyDate === "string" ? a.dutyDate : a.dutyDate.toISOString()).substring(0, 10)
    const emp = employeeMap.get(empId)!
    if (!emp.duties[dateStr]) {
      emp.duties[dateStr] = []
    }

    const cell: DutyCalendarCell = {
      id: a.id,
      dutyTypeCode: a.dutyType.code,
      dutyTypeName: a.dutyType.name,
      dutyTypeColor: a.dutyType.color,
      startTime: getTimeHHMM(a.startTime),
      endTime: getTimeHHMM(a.endTime),
      reducesCapacity: a.reducesCapacity,
    }
    emp.duties[dateStr].push(cell)

    // 集計
    const dtKey = a.dutyType.code
    if (!dutyTypeCountMap.has(dtKey)) {
      dutyTypeCountMap.set(dtKey, {
        code: a.dutyType.code,
        name: a.dutyType.name,
        color: a.dutyType.color,
        count: 0,
      })
    }
    dutyTypeCountMap.get(dtKey)!.count++
  }

  // グループ名昇順 → 従業員名昇順
  const data = Array.from(employeeMap.values()).sort((a, b) => {
    const gCmp = (a.groupName ?? "zzz").localeCompare(b.groupName ?? "zzz", "ja")
    if (gCmp !== 0) return gCmp
    return a.employeeName.localeCompare(b.employeeName, "ja")
  })

  const dutyTypeSummary = Array.from(dutyTypeCountMap.values()).sort((a, b) => a.code.localeCompare(b.code))

  return { data, dutyTypeSummary }
}

/** 日次ビューのフィルター選択肢を取得 */
export async function getDutyDailyFilterOptions(date: Date): Promise<DutyDailyFilterOptions> {
  const employeeSet = new Map<string, string>()
  const groupSet = new Map<number, string>()
  const dutyTypeSet = new Map<number, { code: string; name: string; color: string | null }>()

  // 全業務割当からフィルター候補を収集
  const allAssignments = await prisma.dutyAssignment.findMany({
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
  })

  for (const a of allAssignments) {
    employeeSet.set(a.employeeId, a.employee.name)
    for (const eg of a.employee.groups) {
      groupSet.set(eg.group.id, eg.group.name)
    }
    dutyTypeSet.set(a.dutyTypeId, {
      code: a.dutyType.code,
      name: a.dutyType.name,
      color: a.dutyType.color,
    })
  }

  return {
    employees: Array.from(employeeSet.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    groups: Array.from(groupSet.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
    dutyTypes: Array.from(dutyTypeSet.entries())
      .map(([id, dt]) => ({ id, ...dt }))
      .sort((a, b) => a.code.localeCompare(b.code)),
  }
}
