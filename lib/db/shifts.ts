import { prisma } from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"
import type { ShiftFilterParams, ShiftDailyFilterParams, ShiftDailyRow, PaginatedResult, ShiftDailySortField, SortOrder } from "@/types"
import type { ShiftCalendarData, ShiftCalendarPaginatedResult, DailyFilterOptions } from "@/types/shifts"
import { toDateString } from "@/lib/date-utils"

export async function getShiftsForCalendar(
  filter: ShiftFilterParams
): Promise<ShiftCalendarData[]> {
  // @db.Date カラムとの比較は UTC 基準で行われるため、
  // ローカル時刻ではなく UTC midnight で日付を生成する
  const startDate = new Date(Date.UTC(filter.year, filter.month - 1, 1))
  const endDate = new Date(Date.UTC(filter.year, filter.month, 0))

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

  const employees = await prisma.employee.findMany({
    where: {
      ...employeeWhere,
      AND: [
        {
          OR: [
            { terminationDate: null },
            { terminationDate: { gte: startDate } },
          ],
        },
      ],
    },
    include: {
      groups: {
        include: { group: true },
        where: { endDate: null },
      },
      shifts: {
        where: {
          shiftDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    },
    orderBy: [{ name: "asc" }],
  })

  return employees.map((emp) => ({
    employeeId: emp.id,
    employeeName: emp.name,
    groupId: emp.groups[0]?.groupId ?? null,
    groupName: emp.groups[0]?.group.name ?? null,
    shifts: Object.fromEntries(
      emp.shifts.map((s) => [toDateString(s.shiftDate), s])
    ),
  }))
}

const DEFAULT_CALENDAR_PAGE_SIZE = 50

export async function getShiftsForCalendarPaginated(
  filter: ShiftFilterParams,
  options: { cursor?: number; pageSize?: number } = {}
): Promise<ShiftCalendarPaginatedResult> {
  const cursor = options.cursor ?? 0
  const pageSize = options.pageSize ?? DEFAULT_CALENDAR_PAGE_SIZE

  const startDate = new Date(Date.UTC(filter.year, filter.month - 1, 1))
  const endDate = new Date(Date.UTC(filter.year, filter.month, 0))

  // --- Prisma where (count用) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {}

  const groupConditions2 = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    groupConditions2.push({ groups: { some: { groupId: { in: filter.groupIds }, endDate: null } } })
  }
  if (filter.unassigned) {
    groupConditions2.push({ groups: { none: { endDate: null } } })
  }
  if (groupConditions2.length > 0) {
    employeeWhere.OR = groupConditions2
  }

  const roleConditions2 = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    roleConditions2.push({ functionRoles: { some: { functionRoleId: { in: filter.roleIds }, endDate: null } } })
  }
  if (filter.roleUnassigned) {
    roleConditions2.push({ functionRoles: { none: { endDate: null } } })
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

  const where = {
    ...employeeWhere,
    AND: [
      {
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: startDate } },
        ],
      },
    ],
  }

  // --- Step 1: Raw SQLでグループ名→従業員名順のIDリストを取得 ---
  const conditions: Prisma.Sql[] = [
    Prisma.sql`(e.termination_date IS NULL OR e.termination_date >= ${startDate})`,
  ]

  const sqlGroupConditions: Prisma.Sql[] = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    sqlGroupConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL AND eg2.group_id = ANY(${filter.groupIds})
    )`)
  }
  if (filter.unassigned) {
    sqlGroupConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL
    )`)
  }
  if (sqlGroupConditions.length > 0) {
    conditions.push(
      sqlGroupConditions.length === 1
        ? sqlGroupConditions[0]
        : Prisma.sql`(${Prisma.join(sqlGroupConditions, " OR ")})`
    )
  }

  const sqlRoleConditions: Prisma.Sql[] = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    sqlRoleConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND efr.end_date IS NULL AND efr.function_role_id = ANY(${filter.roleIds})
    )`)
  }
  if (filter.roleUnassigned) {
    sqlRoleConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND efr.end_date IS NULL
    )`)
  }
  if (sqlRoleConditions.length > 0) {
    conditions.push(
      sqlRoleConditions.length === 1
        ? sqlRoleConditions[0]
        : Prisma.sql`(${Prisma.join(sqlRoleConditions, " OR ")})`
    )
  }

  if (filter.employeeSearch) {
    const searchPattern = `%${filter.employeeSearch}%`
    conditions.push(
      Prisma.sql`(e.name ILIKE ${searchPattern} OR e.name_kana ILIKE ${searchPattern})`
    )
  }

  if (filter.employeeIds && filter.employeeIds.length > 0) {
    conditions.push(Prisma.sql`e.id::text = ANY(${filter.employeeIds})`)
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`

  const orderedIds = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT e.id
    FROM employees e
    LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
    LEFT JOIN groups g ON eg.group_id = g.id
    ${whereClause}
    GROUP BY e.id, e.name
    ORDER BY MIN(g.id) ASC NULLS LAST, e.name ASC
    OFFSET ${cursor} LIMIT ${pageSize + 1}
  `)

  const hasMore = orderedIds.length > pageSize
  const slicedIds = hasMore ? orderedIds.slice(0, pageSize).map((r) => r.id) : orderedIds.map((r) => r.id)

  // --- Step 2: Prisma findManyで完全なデータを取得 ---
  const [employees, total] = await Promise.all([
    slicedIds.length > 0
      ? prisma.employee.findMany({
          where: { id: { in: slicedIds } },
          include: {
            groups: {
              include: { group: true },
              where: { endDate: null },
            },
            shifts: {
              where: {
                shiftDate: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.employee.count({ where }),
  ])

  // --- Step 3: Raw SQLの順序に合わせて並べ替え ---
  const idOrder = new Map(slicedIds.map((id, i) => [id, i]))
  employees.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))

  return {
    data: employees.map((emp) => ({
      employeeId: emp.id,
      employeeName: emp.name,
      groupId: emp.groups[0]?.groupId ?? null,
      groupName: emp.groups[0]?.group.name ?? null,
      shifts: Object.fromEntries(
        emp.shifts.map((s) => [toDateString(s.shiftDate), s])
      ),
    })),
    total,
    hasMore,
    nextCursor: hasMore ? cursor + pageSize : null,
  }
}

/**
 * 月次カレンダーのフィルター用従業員一覧を取得
 */
export async function getCalendarEmployeeOptions(
  filter: ShiftFilterParams
): Promise<{ id: string; name: string }[]> {
  const startDate = new Date(Date.UTC(filter.year, filter.month - 1, 1))

  const conditions: Prisma.Sql[] = [
    Prisma.sql`(e.termination_date IS NULL OR e.termination_date >= ${startDate})`,
  ]

  const sqlGroupConditions: Prisma.Sql[] = []
  if (filter.groupIds && filter.groupIds.length > 0) {
    sqlGroupConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL AND eg2.group_id = ANY(${filter.groupIds})
    )`)
  }
  if (filter.unassigned) {
    sqlGroupConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL
    )`)
  }
  if (sqlGroupConditions.length > 0) {
    conditions.push(
      sqlGroupConditions.length === 1
        ? sqlGroupConditions[0]
        : Prisma.sql`(${Prisma.join(sqlGroupConditions, " OR ")})`
    )
  }

  const sqlRoleConditions: Prisma.Sql[] = []
  if (filter.roleIds && filter.roleIds.length > 0) {
    sqlRoleConditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND efr.end_date IS NULL AND efr.function_role_id = ANY(${filter.roleIds})
    )`)
  }
  if (filter.roleUnassigned) {
    sqlRoleConditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_function_roles efr
      WHERE efr.employee_id = e.id AND efr.end_date IS NULL
    )`)
  }
  if (sqlRoleConditions.length > 0) {
    conditions.push(
      sqlRoleConditions.length === 1
        ? sqlRoleConditions[0]
        : Prisma.sql`(${Prisma.join(sqlRoleConditions, " OR ")})`
    )
  }

  if (filter.employeeSearch) {
    const searchPattern = `%${filter.employeeSearch}%`
    conditions.push(
      Prisma.sql`(e.name ILIKE ${searchPattern} OR e.name_kana ILIKE ${searchPattern})`
    )
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`

  return prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
    SELECT e.id, e.name
    FROM employees e
    ${whereClause}
    ORDER BY e.name
  `)
}

const DEFAULT_DAILY_PAGE_SIZE = 30

// ソートフィールド → SQL式マッピング（GROUP BY対応で集約関数を使用）
function getDailySortExpression(sortBy: ShiftDailySortField, roleTypes: [string, string]): string {
  // SQL インジェクション防止: シングルクォートをエスケープ
  const escapeSQL = (val: string) => val.replace(/'/g, "''")
  switch (sortBy) {
    case "employeeName": return "e.name"
    case "groupName": return "MIN(g.name)"
    case "supervisorRoleName": return `MIN((SELECT fr.role_name FROM employee_function_roles efr JOIN function_roles fr ON efr.function_role_id = fr.id WHERE efr.employee_id = e.id AND efr.end_date IS NULL AND fr.role_type = '${escapeSQL(roleTypes[0])}' LIMIT 1))`
    case "businessRoleName": return `MIN((SELECT fr.role_name FROM employee_function_roles efr JOIN function_roles fr ON efr.function_role_id = fr.id WHERE efr.employee_id = e.id AND efr.end_date IS NULL AND fr.role_type = '${escapeSQL(roleTypes[1])}' LIMIT 1))`
    case "shiftCode": return "MIN(s.shift_code)"
    case "isRemote": return "MIN(s.is_remote::int)"
    default: return "e.name"
  }
}

/**
 * 日次フィルター条件構築ヘルパー。
 * exclude パラメータで特定のフィルター条件をスキップすることで、
 * カスケードフィルターのオプション取得時に「自分自身の条件を除外」できる。
 */
function buildDailyFilterConditions(
  filter: ShiftDailyFilterParams,
  dateStr: string,
  exclude?: "employeeIds" | "groupIds" | "shiftCodes" | "supervisorRoleNames" | "businessRoleNames",
  roleTypes?: [string, string]
): {
  conditions: Prisma.Sql[]
  shiftFilterConditions: Prisma.Sql[]
  hasShiftFilter: boolean
  shiftJoin: Prisma.Sql
} {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`(e.termination_date IS NULL OR e.termination_date >= ${dateStr}::date)`,
  ]

  // グループフィルター
  if (exclude !== "groupIds") {
    const sqlGroupConditions: Prisma.Sql[] = []
    if (filter.groupIds && filter.groupIds.length > 0) {
      sqlGroupConditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM employee_groups eg2
        WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL AND eg2.group_id = ANY(${filter.groupIds})
      )`)
    }
    if (filter.unassigned) {
      sqlGroupConditions.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM employee_groups eg2
        WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL
      )`)
    }
    if (sqlGroupConditions.length > 0) {
      conditions.push(
        sqlGroupConditions.length === 1
          ? sqlGroupConditions[0]
          : Prisma.sql`(${Prisma.join(sqlGroupConditions, " OR ")})`
      )
    }
  }

  // 従業員名検索
  if (filter.employeeSearch) {
    const searchPattern = `%${filter.employeeSearch}%`
    conditions.push(
      Prisma.sql`(e.name ILIKE ${searchPattern} OR e.name_kana ILIKE ${searchPattern})`
    )
  }

  // 従業員IDフィルター
  if (exclude !== "employeeIds" && filter.employeeIds && filter.employeeIds.length > 0) {
    conditions.push(Prisma.sql`e.id = ANY(${filter.employeeIds}::uuid[])`)
  }

  // 監督ロール名フィルター
  if (exclude !== "supervisorRoleNames" && filter.supervisorRoleNames && filter.supervisorRoleNames.length > 0 && roleTypes) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_function_roles efr
      JOIN function_roles fr ON efr.function_role_id = fr.id
      WHERE efr.employee_id = e.id AND efr.end_date IS NULL
        AND fr.role_type = ${roleTypes[0]}
        AND fr.role_name = ANY(${filter.supervisorRoleNames})
    )`)
  }

  // 業務ロール名フィルター
  if (exclude !== "businessRoleNames" && filter.businessRoleNames && filter.businessRoleNames.length > 0 && roleTypes) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_function_roles efr
      JOIN function_roles fr ON efr.function_role_id = fr.id
      WHERE efr.employee_id = e.id AND efr.end_date IS NULL
        AND fr.role_type = ${roleTypes[1]}
        AND fr.role_name = ANY(${filter.businessRoleNames})
    )`)
  }

  // シフト関連フィルター（シフトコード、時刻、isHoliday、isRemote）
  const shiftFilterConditions: Prisma.Sql[] = []
  if (exclude !== "shiftCodes" && filter.shiftCodes && filter.shiftCodes.length > 0) {
    shiftFilterConditions.push(Prisma.sql`s.shift_code = ANY(${filter.shiftCodes})`)
  }
  if (filter.isRemote) {
    shiftFilterConditions.push(Prisma.sql`s.is_remote = true`)
  }

  const hasShiftFilter = shiftFilterConditions.length > 0

  const shiftJoin = hasShiftFilter
    ? Prisma.sql`INNER JOIN shifts s ON e.id = s.employee_id AND s.shift_date = ${dateStr}::date`
    : Prisma.sql`LEFT JOIN shifts s ON e.id = s.employee_id AND s.shift_date = ${dateStr}::date`

  if (hasShiftFilter) {
    for (const cond of shiftFilterConditions) {
      conditions.push(cond)
    }
  }

  return { conditions, shiftFilterConditions, hasShiftFilter, shiftJoin }
}

export async function getShiftsForDaily(
  filter: ShiftDailyFilterParams,
  pagination: { page?: number; pageSize?: number } = {}
): Promise<PaginatedResult<ShiftDailyRow>> {
  const page = pagination.page ?? 1
  const pageSize = pagination.pageSize ?? DEFAULT_DAILY_PAGE_SIZE

  // DB から distinct role_type を取得して動的にカラムマッピング
  const distinctTypes = await prisma.functionRole.findMany({
    select: { roleType: true },
    distinct: ["roleType"],
    orderBy: { roleType: "desc" },
  })
  const roleTypes: [string, string] = [
    distinctTypes[0]?.roleType ?? "監督",
    distinctTypes[1]?.roleType ?? "業務",
  ]

  // Raw SQL では文字列 + ::date キャストで日付比較（Date オブジェクトは型不一致になるため）
  const dateStr = filter.date // "YYYY-MM-DD" 形式
  // Prisma findMany 用（@db.Date カラム比較用 UTC midnight）
  const [y, m, d] = filter.date.split("-").map(Number)
  const targetDate = new Date(Date.UTC(y, m - 1, d))

  const sortBy: ShiftDailySortField = filter.sortBy ?? "employeeName"
  const sortOrder: SortOrder = filter.sortOrder ?? "asc"

  // --- Step 1: Raw SQLで動的 ORDER BY + OFFSET/LIMIT で従業員IDリスト取得 ---
  const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, undefined, roleTypes)

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`

  // ソート式構築
  const sortExpr = getDailySortExpression(sortBy, roleTypes)
  const nullsHandling = sortOrder === "asc" ? "NULLS LAST" : "NULLS FIRST"
  // セカンダリソートとして常に e.name ASC を追加
  const orderByRaw = sortBy === "employeeName"
    ? `ORDER BY e.name ${sortOrder}`
    : `ORDER BY ${sortExpr} ${sortOrder} ${nullsHandling}, e.name ASC`
  const orderByClause = Prisma.raw(orderByRaw)

  const offset = (page - 1) * pageSize

  const [orderedIds, countResult] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT e.id
      FROM employees e
      LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
      LEFT JOIN groups g ON eg.group_id = g.id
      ${shiftJoin}
      ${whereClause}
      GROUP BY e.id, e.name
      ${orderByClause}
      OFFSET ${offset} LIMIT ${pageSize}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT e.id) as count
      FROM employees e
      LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
      ${shiftJoin}
      ${whereClause}
    `),
  ])

  const total = Number(countResult[0]?.count ?? 0)
  const slicedIds = orderedIds.map((r) => r.id)

  // --- Step 2: Prisma findManyで完全なデータを取得 ---
  const employees = slicedIds.length > 0
    ? await prisma.employee.findMany({
        where: { id: { in: slicedIds } },
        include: {
          groups: {
            include: { group: true },
            where: { endDate: null },
          },
          shifts: {
            where: { shiftDate: targetDate },
          },
          functionRoles: {
            where: { endDate: null },
            include: { functionRole: true },
          },
        },
      })
    : []

  // --- Step 3: Raw SQLの順序に合わせて並べ替え ---
  const idOrder = new Map(slicedIds.map((id, i) => [id, i]))
  employees.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))

  const data: ShiftDailyRow[] = employees.map((emp) => {
    const shift = emp.shifts[0] ?? null
    const supervisorRole = emp.functionRoles.find(fr => fr.functionRole?.roleType === roleTypes[0])
    const businessRole = emp.functionRoles.find(fr => fr.functionRole?.roleType === roleTypes[1])
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      groupName: emp.groups[0]?.group.name ?? null,
      supervisorRoleName: supervisorRole?.functionRole?.roleName ?? null,
      businessRoleName: businessRole?.functionRole?.roleName ?? null,
      shiftId: shift?.id ?? null,
      shiftCode: shift?.shiftCode ?? "",
      startTime: shift?.startTime ?? null,
      endTime: shift?.endTime ?? null,
      isHoliday: shift?.isHoliday ?? null,
      isRemote: shift?.isRemote ?? false,
    }
  })

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getShiftIdsWithHistory(
  year: number,
  month: number
): Promise<Set<number>> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))

  const records = await prisma.shiftChangeHistory.findMany({
    where: {
      shiftDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: { shiftId: true },
    distinct: ["shiftId"],
  })

  return new Set(records.map((r) => r.shiftId))
}

export type LatestShiftHistory = {
  shiftCode: string | null
  newShiftCode: string | null
  note: string | null
  isRemote: boolean | null
  newIsRemote: boolean | null
}

export async function getLatestShiftHistoryEntries(
  year: number,
  month: number
): Promise<Record<number, LatestShiftHistory>> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))

  const records = await prisma.$queryRaw<
    { shift_id: number; shift_code: string | null; new_shift_code: string | null; note: string | null; is_remote: boolean | null; new_is_remote: boolean | null }[]
  >`
    SELECT DISTINCT ON (shift_id) shift_id, shift_code, new_shift_code, note, is_remote, new_is_remote
    FROM shift_change_history
    WHERE shift_date >= ${startDate} AND shift_date <= ${endDate}
    ORDER BY shift_id, version DESC
  `

  const result: Record<number, LatestShiftHistory> = {}
  for (const r of records) {
    result[r.shift_id] = {
      shiftCode: r.shift_code,
      newShiftCode: r.new_shift_code,
      note: r.note,
      isRemote: r.is_remote,
      newIsRemote: r.new_is_remote,
    }
  }
  return result
}

/**
 * カスケードフィルター用オプション取得。
 * 各フィルターの選択肢は「自分自身のフィルター条件を除外し、他の全フィルター条件を適用した結果」から抽出する。
 */
export async function getDailyFilterOptions(
  filter: ShiftDailyFilterParams
): Promise<DailyFilterOptions> {
  const dateStr = filter.date

  // roleTypes を取得
  const distinctTypes = await prisma.functionRole.findMany({
    select: { roleType: true },
    distinct: ["roleType"],
    orderBy: { roleType: "desc" },
  })
  const roleTypes: [string, string] = [
    distinctTypes[0]?.roleType ?? "監督",
    distinctTypes[1]?.roleType ?? "業務",
  ]

  // クエリを並列実行
  const [employeeRows, groupRows, unassignedRows, shiftCodeRows, supervisorRoleRows, businessRoleRows] = await Promise.all([
    // 従業員オプション: employeeIds 条件を除外
    (() => {
      const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, "employeeIds", roleTypes)
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      return prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
        SELECT DISTINCT e.id, e.name
        FROM employees e
        LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
        LEFT JOIN groups g ON eg.group_id = g.id
        ${shiftJoin}
        ${whereClause}
        ORDER BY e.name
      `)
    })(),
    // グループオプション: groupIds 条件を除外
    (() => {
      const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, "groupIds", roleTypes)
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      return prisma.$queryRaw<{ id: number; name: string }[]>(Prisma.sql`
        SELECT DISTINCT g.id, g.name
        FROM employees e
        LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
        LEFT JOIN groups g ON eg.group_id = g.id
        ${shiftJoin}
        ${whereClause}
        AND g.id IS NOT NULL
        ORDER BY g.name
      `)
    })(),
    // 未所属の従業員が存在するかチェック（groupIds 条件を除外）
    (() => {
      const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, "groupIds", roleTypes)
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      return prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM employees e
          LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
          ${shiftJoin}
          ${whereClause}
          AND eg.employee_id IS NULL
        ) as exists
      `)
    })(),
    // シフトコードオプション: shiftCodes 条件を除外
    (() => {
      const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, "shiftCodes", roleTypes)
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      return prisma.$queryRaw<{ shift_code: string }[]>(Prisma.sql`
        SELECT DISTINCT s2.shift_code
        FROM employees e
        LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
        ${shiftJoin}
        INNER JOIN shifts s2 ON e.id = s2.employee_id AND s2.shift_date = ${dateStr}::date
        ${whereClause}
        AND s2.shift_code IS NOT NULL
        ORDER BY s2.shift_code
      `)
    })(),
    // 監督ロール名オプション: supervisorRoleNames 条件を除外
    (() => {
      const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, "supervisorRoleNames", roleTypes)
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      return prisma.$queryRaw<{ role_name: string }[]>(Prisma.sql`
        SELECT DISTINCT fr.role_name
        FROM employees e
        LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
        ${shiftJoin}
        INNER JOIN employee_function_roles efr ON efr.employee_id = e.id AND efr.end_date IS NULL
        INNER JOIN function_roles fr ON efr.function_role_id = fr.id AND fr.role_type = ${roleTypes[0]}
        ${whereClause}
        ORDER BY fr.role_name
      `)
    })(),
    // 業務ロール名オプション: businessRoleNames 条件を除外
    (() => {
      const { conditions, shiftJoin } = buildDailyFilterConditions(filter, dateStr, "businessRoleNames", roleTypes)
      const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      return prisma.$queryRaw<{ role_name: string }[]>(Prisma.sql`
        SELECT DISTINCT fr.role_name
        FROM employees e
        LEFT JOIN employee_groups eg ON e.id = eg.employee_id AND eg.end_date IS NULL
        ${shiftJoin}
        INNER JOIN employee_function_roles efr ON efr.employee_id = e.id AND efr.end_date IS NULL
        INNER JOIN function_roles fr ON efr.function_role_id = fr.id AND fr.role_type = ${roleTypes[1]}
        ${whereClause}
        ORDER BY fr.role_name
      `)
    })(),
  ])

  return {
    employees: employeeRows,
    groups: groupRows.map((r) => ({ id: Number(r.id), name: r.name })),
    shiftCodes: shiftCodeRows.map((r) => r.shift_code),
    hasUnassigned: unassignedRows[0]?.exists ?? false,
    supervisorRoleNames: supervisorRoleRows.map((r) => r.role_name),
    businessRoleNames: businessRoleRows.map((r) => r.role_name),
  }
}

export async function getShiftById(id: number) {
  return prisma.shift.findUnique({
    where: { id },
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
  })
}
