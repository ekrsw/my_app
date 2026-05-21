import { prisma } from "@/lib/prisma"
import { getTimeHHMM } from "@/lib/capacity-utils"

export async function getDailyDutyAssignments(date: Date) {
  return prisma.dutyAssignment.findMany({
    where: {
      dutyDate: date,
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
            where: {
              AND: [
                { OR: [{ startDate: null }, { startDate: { lte: date } }] },
                { OR: [{ endDate: null }, { endDate: { gte: date } }] },
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
 * 指定日の前日の深夜跨ぎ業務割当（日跨ぎで当日も継続中のもの）を取得する。
 * endTime の HH:mm が startTime の HH:mm より小さい割当を深夜跨ぎとみなす。
 */
export async function getPreviousDayOvernightDutyAssignments(date: Date) {
  const previousDay = new Date(date.getTime() - 24 * 60 * 60 * 1000)

  const previousDayDuties = await prisma.dutyAssignment.findMany({
    where: {
      dutyDate: previousDay,
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
            where: {
              AND: [
                { OR: [{ startDate: null }, { startDate: { lte: date } }] },
                { OR: [{ endDate: null }, { endDate: { gte: date } }] },
              ],
            },
          },
        },
      },
      dutyType: true,
    },
  })

  return previousDayDuties.filter((d) => {
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
  DutyCalendarData,
  DutyCalendarCell,
  DutyCalendarFilterParams,
  DutyCalendarPaginatedResult,
} from "@/types/duties"
import { Prisma } from "@/app/generated/prisma/client"

const DEFAULT_CALENDAR_PAGE_SIZE = 50

// --- 月次ビュー用ヘルパー（期間オーバーラップ判定 + 月末スナップショット） ---
// 設計書: docs/plans/duty-assignment-monthly-filter-spec.md
//
// 用途別の判定基準:
//   - フィルター判定: 選択月との期間オーバーラップ
//   - グループ Badge 表示: 選択月内に有効だった所属を全件併記
//   - 並び順（ソート）: 選択月の月末時点の所属グループ ID

/** EmployeeGroup 用: 選択月との期間オーバーラップ判定 (Prisma where) */
function monthOverlapGroupWhere(monthStart: Date, monthEnd: Date) {
  return {
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: monthEnd } }] },
      { OR: [{ endDate: null }, { endDate: { gte: monthStart } }] },
    ],
  }
}

/** EmployeeFunctionRole 用: 選択月との期間オーバーラップ判定 (Prisma where) */
function monthOverlapRoleWhere(monthStart: Date, monthEnd: Date) {
  return {
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: monthEnd } }] },
      { OR: [{ endDate: null }, { endDate: { gte: monthStart } }] },
    ],
  }
}

// Raw SQL alias は literal union で型レベル制限（任意文字列の注入を防ぐ）
type GroupSqlAlias = "eg2" | "eg_sort"
type RoleSqlAlias = "efr" | "efr_sort"

/** Raw SQL 用: 選択月との期間オーバーラップ判定 (EXISTS 句で使用) */
function monthOverlapGroupSql(
  monthStartStr: string,
  monthEndStr: string,
  alias: GroupSqlAlias
) {
  return Prisma.sql`(${Prisma.raw(alias)}.start_date IS NULL OR ${Prisma.raw(alias)}.start_date <= ${monthEndStr}::date)
    AND (${Prisma.raw(alias)}.end_date IS NULL OR ${Prisma.raw(alias)}.end_date >= ${monthStartStr}::date)`
}

function monthOverlapRoleSql(
  monthStartStr: string,
  monthEndStr: string,
  alias: RoleSqlAlias
) {
  return Prisma.sql`(${Prisma.raw(alias)}.start_date IS NULL OR ${Prisma.raw(alias)}.start_date <= ${monthEndStr}::date)
    AND (${Prisma.raw(alias)}.end_date IS NULL OR ${Prisma.raw(alias)}.end_date >= ${monthStartStr}::date)`
}

/** Raw SQL 用: 月末スナップショット判定 (ORDER BY 用 LEFT JOIN で使用) */
function monthEndSnapshotGroupSql(monthEndStr: string, alias: GroupSqlAlias) {
  return Prisma.sql`(${Prisma.raw(alias)}.start_date IS NULL OR ${Prisma.raw(alias)}.start_date <= ${monthEndStr}::date)
    AND (${Prisma.raw(alias)}.end_date IS NULL OR ${Prisma.raw(alias)}.end_date >= ${monthEndStr}::date)`
}

/** 月次ビュー用: カレンダーデータ取得（全従業員ベース + フィルター + ページネーション） */
export async function getDutyAssignmentsForCalendar(
  filter: DutyCalendarFilterParams,
  options: { cursor?: number; pageSize?: number } = {}
): Promise<DutyCalendarPaginatedResult> {
  const cursor = options.cursor ?? 0
  const pageSize = options.pageSize ?? DEFAULT_CALENDAR_PAGE_SIZE
  // 選択月の範囲 [monthStart, monthEnd] (両端含む)
  const monthStart = new Date(Date.UTC(filter.year, filter.month - 1, 1))
  const monthEnd = new Date(Date.UTC(filter.year, filter.month, 0))
  const monthStartStr = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, "0")}-${String(monthStart.getUTCDate()).padStart(2, "0")}`
  const monthEndStr = `${monthEnd.getUTCFullYear()}-${String(monthEnd.getUTCMonth() + 1).padStart(2, "0")}-${String(monthEnd.getUTCDate()).padStart(2, "0")}`
  // 期間オーバーラップ判定: 選択月内に 1 日でも所属/有効だった人を表示
  const groupDateFilter = monthOverlapGroupWhere(monthStart, monthEnd)
  const roleDateFilter = monthOverlapRoleWhere(monthStart, monthEnd)

  // --- Step 1: Raw SQL で従業員IDリストを取得（グループ名→従業員名順） ---
  // terminationDate は source of truth（設計書「データ不整合シナリオ」参照）
  const conditions: Prisma.Sql[] = [
    Prisma.sql`(e.termination_date IS NULL OR e.termination_date >= ${monthStartStr}::date)`,
  ]

  // グループフィルター: 期間オーバーラップ判定
  const sqlGroupConditions: Prisma.Sql[] = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    sqlGroupConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND ${monthOverlapGroupSql(monthStartStr, monthEndStr, "eg2")} AND eg2.group_id = ANY(${filter.groupIds})
    )`)
  }
  if (filter.unassigned) {
    sqlGroupConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND ${monthOverlapGroupSql(monthStartStr, monthEndStr, "eg2")}
    )`)
  }
  if (sqlGroupConditions.length > 0) {
    conditions.push(
      sqlGroupConditions.length === 1
        ? sqlGroupConditions[0]
        : Prisma.sql`(${Prisma.join(sqlGroupConditions, " OR ")})`
    )
  }

  // ロールフィルター: 期間オーバーラップ判定
  const sqlRoleConditions: Prisma.Sql[] = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    sqlRoleConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND ${monthOverlapRoleSql(monthStartStr, monthEndStr, "efr")} AND efr.function_role_id = ANY(${filter.roleIds})
    )`)
  }
  if (filter.roleUnassigned) {
    sqlRoleConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND ${monthOverlapRoleSql(monthStartStr, monthEndStr, "efr")}
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
      WHERE da.employee_id = e.id AND da.duty_date >= ${monthStartStr}::date AND da.duty_date <= ${monthEndStr}::date AND da.duty_type_id = ANY(${filter.dutyTypeIds})
    )`)
  }
  if (filter.dutyUnassigned) {
    sqlDutyConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM duty_assignments da
      WHERE da.employee_id = e.id AND da.duty_date >= ${monthStartStr}::date AND da.duty_date <= ${monthEndStr}::date
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

  // ORDER BY 用 LEFT JOIN: 月末スナップショット基準（フィルター JOIN とエイリアス分離）
  // 退職者など月末非所属者は NULLS LAST で末尾に集まる
  const orderedIds = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id
    FROM employees e
    LEFT JOIN employee_groups eg_sort ON e.id = eg_sort.employee_id AND ${monthEndSnapshotGroupSql(monthEndStr, "eg_sort")}
    LEFT JOIN groups g_sort ON eg_sort.group_id = g_sort.id
    ${whereClause}
    GROUP BY e.id, e.name
    ORDER BY MIN(g_sort.id) ASC NULLS LAST, e.name ASC
    OFFSET ${cursor} LIMIT ${pageSize + 1}
  `)

  const hasMore = orderedIds.length > pageSize
  const slicedIds = hasMore ? orderedIds.slice(0, pageSize).map((r) => r.id) : orderedIds.map((r) => r.id)

  // --- Prisma where (count用) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {
    OR: [
      { terminationDate: null },
      { terminationDate: { gte: monthStart } },
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
          dutyDate: { gte: monthStart, lte: monthEnd },
          dutyTypeId: { in: filter.dutyTypeIds },
        },
      },
    })
  }
  if (filter.dutyUnassigned) {
    dutyConditions2.push({
      dutyAssignments: {
        none: {
          dutyDate: { gte: monthStart, lte: monthEnd },
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
              orderBy: { groupId: "asc" },
            },
            dutyAssignments: {
              where: {
                dutyDate: { gte: monthStart, lte: monthEnd },
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
    // 期間オーバーラップでヒットしたグループを全件併記（Prisma orderBy で groupId 昇順済み）
    const groupNames = emp.groups.map((eg) => eg.group.name)
    // terminationDate を source of truth とした退職判定（設計書「データ不整合シナリオ」参照）
    const terminationDateStr = emp.terminationDate
      ? (typeof emp.terminationDate === "string"
          ? emp.terminationDate
          : emp.terminationDate.toISOString()
        ).substring(0, 10)
      : null
    const isTerminated = terminationDateStr !== null && terminationDateStr <= monthEndStr
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
      groupNames,
      isTerminated,
      terminationDate: terminationDateStr,
      duties,
    }
  })

  const dutyTypeSummary = Array.from(dutyTypeCountMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)

  return { data, dutyTypeSummary, total, hasMore, nextCursor: hasMore ? cursor + pageSize : null }
}

