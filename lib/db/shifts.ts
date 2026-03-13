import { prisma } from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"
import type { ShiftFilterParams, ShiftDailyFilterParams, ShiftDailyRow, PaginatedResult } from "@/types"
import type { ShiftCalendarData, ShiftCalendarPaginatedResult } from "@/types/shifts"
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

const DEFAULT_DAILY_PAGE_SIZE = 30

export async function getShiftsForDaily(
  filter: ShiftDailyFilterParams,
  pagination: { page?: number; pageSize?: number } = {}
): Promise<PaginatedResult<ShiftDailyRow>> {
  const page = pagination.page ?? 1
  const pageSize = pagination.pageSize ?? DEFAULT_DAILY_PAGE_SIZE

  // @db.Date カラム比較用 UTC midnight
  const [y, m, d] = filter.date.split("-").map(Number)
  const targetDate = new Date(Date.UTC(y, m - 1, d))

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

  // 従業員名検索
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

  // シフト条件
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shiftWhere: any = { shiftDate: targetDate }

  if (filter.shiftCodes && filter.shiftCodes.length > 0) {
    shiftWhere.shiftCode = { in: filter.shiftCodes }
  }

  if (filter.startTimeFrom) {
    const [hh, mm] = filter.startTimeFrom.split(":").map(Number)
    const fromTime = new Date(Date.UTC(1970, 0, 1, hh, mm))
    shiftWhere.startTime = { ...shiftWhere.startTime, gte: fromTime }
  }

  if (filter.endTimeTo) {
    const [hh, mm] = filter.endTimeTo.split(":").map(Number)
    const toTime = new Date(Date.UTC(1970, 0, 1, hh, mm))
    shiftWhere.endTime = { ...shiftWhere.endTime, lte: toTime }
  }

  // シフトコード・時刻フィルターが指定されている場合、シフトが存在する従業員のみ
  const hasShiftFilter = !!(
    (filter.shiftCodes && filter.shiftCodes.length > 0) ||
    filter.startTimeFrom ||
    filter.endTimeTo
  )

  if (hasShiftFilter) {
    employeeWhere.AND = [
      ...(employeeWhere.AND ?? []),
      { shifts: { some: shiftWhere } },
    ]
  }

  const where = {
    ...employeeWhere,
    OR: employeeWhere.OR ?? undefined,
    AND: [
      ...(employeeWhere.AND ?? []),
      {
        OR: [
          { terminationDate: null },
          { terminationDate: { gte: targetDate } },
        ],
      },
    ],
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        groups: {
          include: { group: true },
          where: { endDate: null },
        },
        shifts: {
          where: { shiftDate: targetDate },
        },
      },
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.employee.count({ where }),
  ])

  const data: ShiftDailyRow[] = employees.map((emp) => {
    const shift = emp.shifts[0] ?? null
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      groupName: emp.groups[0]?.group.name ?? null,
      shiftId: shift?.id ?? null,
      shiftCode: shift?.shiftCode ?? "",
      startTime: shift?.startTime ?? null,
      endTime: shift?.endTime ?? null,
      isHoliday: shift?.isHoliday ?? false,
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
