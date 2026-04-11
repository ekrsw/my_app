import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"
import { getTimeHHMM } from "@/lib/capacity-utils"

export async function getTodayDutyAssignments() {
  const today = getTodayJST()

  return prisma.dutyAssignment.findMany({
    where: {
      dutyDate: today,
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
    where: {
      dutyDate: yesterday,
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
  DutyCalendarData,
  DutyCalendarCell,
  DutyCalendarFilterParams,
  DutyCalendarPaginatedResult,
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

const DEFAULT_CALENDAR_PAGE_SIZE = 50

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

/** 月次ビュー用: カレンダーデータ取得（全従業員ベース + フィルター + ページネーション） */
export async function getDutyAssignmentsForCalendar(
  filter: DutyCalendarFilterParams,
  options: { cursor?: number; pageSize?: number } = {}
): Promise<DutyCalendarPaginatedResult> {
  const cursor = options.cursor ?? 0
  const pageSize = options.pageSize ?? DEFAULT_CALENDAR_PAGE_SIZE
  const startDate = new Date(Date.UTC(filter.year, filter.month - 1, 1))
  const endDate = new Date(Date.UTC(filter.year, filter.month, 0))
  const startDateStr = `${startDate.getUTCFullYear()}-${String(startDate.getUTCMonth() + 1).padStart(2, "0")}-${String(startDate.getUTCDate()).padStart(2, "0")}`
  const endDateStr = `${endDate.getUTCFullYear()}-${String(endDate.getUTCMonth() + 1).padStart(2, "0")}-${String(endDate.getUTCDate()).padStart(2, "0")}`
  const today = getTodayJST()
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`
  const groupDateFilter = currentGroupDateWhere(today)
  const roleDateFilter = currentRoleDateWhere(today)

  // --- Step 1: Raw SQL で従業員IDリストを取得（グループ名→従業員名順） ---
  const conditions: Prisma.Sql[] = [
    Prisma.sql`(e.termination_date IS NULL OR e.termination_date >= ${startDateStr}::date)`,
  ]

  // グループフィルター
  const sqlGroupConditions: Prisma.Sql[] = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    sqlGroupConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND (eg2.start_date IS NULL OR eg2.start_date <= ${todayStr}::date) AND (eg2.end_date IS NULL OR eg2.end_date >= ${todayStr}::date) AND eg2.group_id = ANY(${filter.groupIds})
    )`)
  }
  if (filter.unassigned) {
    sqlGroupConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND (eg2.start_date IS NULL OR eg2.start_date <= ${todayStr}::date) AND (eg2.end_date IS NULL OR eg2.end_date >= ${todayStr}::date)
    )`)
  }
  if (sqlGroupConditions.length > 0) {
    conditions.push(
      sqlGroupConditions.length === 1
        ? sqlGroupConditions[0]
        : Prisma.sql`(${Prisma.join(sqlGroupConditions, " OR ")})`
    )
  }

  // ロールフィルター
  const sqlRoleConditions: Prisma.Sql[] = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    sqlRoleConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND (efr.start_date IS NULL OR efr.start_date <= ${todayStr}::date) AND (efr.end_date IS NULL OR efr.end_date >= ${todayStr}::date) AND efr.function_role_id = ANY(${filter.roleIds})
    )`)
  }
  if (filter.roleUnassigned) {
    sqlRoleConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND (efr.start_date IS NULL OR efr.start_date <= ${todayStr}::date) AND (efr.end_date IS NULL OR efr.end_date >= ${todayStr}::date)
    )`)
  }
  if (sqlRoleConditions.length > 0) {
    conditions.push(
      sqlRoleConditions.length === 1
        ? sqlRoleConditions[0]
        : Prisma.sql`(${Prisma.join(sqlRoleConditions, " OR ")})`
    )
  }

  // 業務種別フィルター
  const sqlDutyConditions: Prisma.Sql[] = []
  if (filter.dutyTypeIds && filter.dutyTypeIds.length > 0) {
    sqlDutyConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM duty_assignments da
      WHERE da.employee_id = e.id AND da.duty_date >= ${startDateStr}::date AND da.duty_date <= ${endDateStr}::date AND da.duty_type_id = ANY(${filter.dutyTypeIds})
    )`)
  }
  if (filter.dutyUnassigned) {
    sqlDutyConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM duty_assignments da
      WHERE da.employee_id = e.id AND da.duty_date >= ${startDateStr}::date AND da.duty_date <= ${endDateStr}::date
    )`)
  }
  if (sqlDutyConditions.length > 0) {
    conditions.push(
      sqlDutyConditions.length === 1
        ? sqlDutyConditions[0]
        : Prisma.sql`(${Prisma.join(sqlDutyConditions, " OR ")})`
    )
  }

  // 従業員検索
  if (filter.employeeSearch) {
    const searchPattern = `%${filter.employeeSearch}%`
    conditions.push(
      Prisma.sql`(e.name ILIKE ${searchPattern} OR e.name_kana ILIKE ${searchPattern})`
    )
  }

  // 従業員ID指定
  if (filter.employeeIds && filter.employeeIds.length > 0) {
    conditions.push(Prisma.sql`e.id::text = ANY(${filter.employeeIds})`)
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`

  const orderedIds = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id
    FROM employees e
    LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND (eg.start_date IS NULL OR eg.start_date <= ${todayStr}::date) AND (eg.end_date IS NULL OR eg.end_date >= ${todayStr}::date)
    LEFT JOIN groups g ON eg.group_id = g.id
    ${whereClause}
    GROUP BY e.id, e.name
    ORDER BY MIN(g.id) ASC NULLS LAST, e.name ASC
    OFFSET ${cursor} LIMIT ${pageSize + 1}
  `)

  const hasMore = orderedIds.length > pageSize
  const slicedIds = hasMore ? orderedIds.slice(0, pageSize).map((r) => r.id) : orderedIds.map((r) => r.id)

  // --- Prisma where (count用) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {
    OR: [
      { terminationDate: null },
      { terminationDate: { gte: startDate } },
    ],
  }

  const groupConditions2 = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    groupConditions2.push({ groups: { some: { groupId: { in: filter.groupIds }, ...groupDateFilter } } })
  }
  if (filter.unassigned) {
    groupConditions2.push({ groups: { none: groupDateFilter } })
  }
  if (groupConditions2.length > 0) {
    employeeWhere.AND = [...(employeeWhere.AND ?? []), groupConditions2.length === 1 ? groupConditions2[0] : { OR: groupConditions2 }]
  }

  const roleConditions2 = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    roleConditions2.push({ functionRoles: { some: { functionRoleId: { in: filter.roleIds }, ...roleDateFilter } } })
  }
  if (filter.roleUnassigned) {
    roleConditions2.push({ functionRoles: { none: roleDateFilter } })
  }
  if (roleConditions2.length > 0) {
    employeeWhere.AND = [...(employeeWhere.AND ?? []), roleConditions2.length === 1 ? roleConditions2[0] : { OR: roleConditions2 }]
  }

  if (filter.employeeSearch) {
    employeeWhere.AND = [
      ...(employeeWhere.AND ?? []),
      {
        OR: [
          { name: { contains: filter.employeeSearch, mode: "insensitive" } },
          { nameKana: { contains: filter.employeeSearch, mode: "insensitive" } },
        ],
      },
    ]
  }

  if (filter.employeeIds && filter.employeeIds.length > 0) {
    employeeWhere.AND = [
      ...(employeeWhere.AND ?? []),
      { id: { in: filter.employeeIds } },
    ]
  }

  // 業務種別フィルター（Prisma版）
  const dutyConditions2 = []
  if (filter.dutyTypeIds && filter.dutyTypeIds.length > 0) {
    dutyConditions2.push({
      dutyAssignments: {
        some: {
          dutyDate: { gte: startDate, lte: endDate },
          dutyTypeId: { in: filter.dutyTypeIds },
        },
      },
    })
  }
  if (filter.dutyUnassigned) {
    dutyConditions2.push({
      dutyAssignments: {
        none: {
          dutyDate: { gte: startDate, lte: endDate },
        },
      },
    })
  }
  if (dutyConditions2.length > 0) {
    employeeWhere.AND = [...(employeeWhere.AND ?? []), dutyConditions2.length === 1 ? dutyConditions2[0] : { OR: dutyConditions2 }]
  }

  // --- Step 2: Prisma でフルデータ取得 ---
  const [employees, total] = await Promise.all([
    slicedIds.length > 0
      ? prisma.employee.findMany({
          where: { id: { in: slicedIds } },
          include: {
            groups: {
              include: { group: true },
              where: groupDateFilter,
            },
            dutyAssignments: {
              where: {
                dutyDate: { gte: startDate, lte: endDate },
              },
              include: { dutyType: true },
              orderBy: [{ dutyDate: "asc" }, { startTime: "asc" }],
            },
          },
        })
      : Promise.resolve([]),
    prisma.employee.count({ where: employeeWhere }),
  ])

  // --- Step 3: Raw SQLの順序に合わせて並べ替え ---
  const idOrder = new Map(slicedIds.map((id, i) => [id, i]))
  employees.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))

  // --- Step 4: DutyCalendarData[] を構築 ---
  const dutyTypeCountMap = new Map<number, { name: string; color: string | null; count: number; sortOrder: number }>()

  const data: DutyCalendarData[] = employees.map((emp) => {
    const groupName = emp.groups[0]?.group.name ?? null
    const duties: Record<string, DutyCalendarCell[]> = {}

    for (const a of emp.dutyAssignments) {
      const dateStr = (typeof a.dutyDate === "string" ? a.dutyDate : a.dutyDate.toISOString()).substring(0, 10)
      if (!duties[dateStr]) {
        duties[dateStr] = []
      }

      const cell: DutyCalendarCell = {
        id: a.id,
        dutyTypeName: a.dutyType.name,
        dutyTypeColor: a.dutyType.color,
        startTime: getTimeHHMM(a.startTime),
        endTime: getTimeHHMM(a.endTime),
        reducesCapacity: a.reducesCapacity,
        note: a.note ?? null,
        title: a.title ?? null,
      }
      duties[dateStr].push(cell)

      // 集計
      const dtKey = a.dutyTypeId
      if (!dutyTypeCountMap.has(dtKey)) {
        dutyTypeCountMap.set(dtKey, {
          name: a.dutyType.name,
          color: a.dutyType.color,
          count: 0,
          sortOrder: a.dutyType.sortOrder,
        })
      }
      dutyTypeCountMap.get(dtKey)!.count++
    }

    return {
      employeeId: emp.id,
      employeeName: emp.name,
      groupName,
      duties,
    }
  })

  const dutyTypeSummary = Array.from(dutyTypeCountMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)

  return { data, dutyTypeSummary, total, hasMore, nextCursor: hasMore ? cursor + pageSize : null }
}

/** 日次ビューのフィルター選択肢を取得 */
export async function getDutyDailyFilterOptions(date: Date): Promise<DutyDailyFilterOptions> {
  const employeeSet = new Map<string, string>()
  const groupSet = new Map<number, string>()
  const dutyTypeSet = new Map<number, { name: string; color: string | null }>()

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
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
  }
}
