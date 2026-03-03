import { prisma } from "@/lib/prisma"
import { Prisma } from "@/app/generated/prisma/client"
import type { ShiftFilterParams, PaginationParams, PaginatedResult } from "@/types"
import type { ShiftWithEmployee, ShiftCalendarData, ShiftCalendarPaginatedResult } from "@/types/shifts"
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

  if (filter.unassigned) {
    employeeWhere.groups = { none: { endDate: null } }
  } else if (filter.groupId) {
    employeeWhere.groups = { some: { groupId: filter.groupId, endDate: null } }
  }

  if (filter.employeeSearch) {
    employeeWhere.OR = [
      { name: { contains: filter.employeeSearch, mode: "insensitive" } },
      { nameKana: { contains: filter.employeeSearch, mode: "insensitive" } },
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

  if (filter.unassigned) {
    employeeWhere.groups = { none: { endDate: null } }
  } else if (filter.groupId) {
    employeeWhere.groups = { some: { groupId: filter.groupId, endDate: null } }
  }

  if (filter.employeeSearch) {
    employeeWhere.OR = [
      { name: { contains: filter.employeeSearch, mode: "insensitive" } },
      { nameKana: { contains: filter.employeeSearch, mode: "insensitive" } },
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

  if (filter.unassigned) {
    conditions.push(Prisma.sql`NOT EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL
    )`)
  } else if (filter.groupId) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM employee_groups eg2
      WHERE eg2.employee_id = e.id AND eg2.end_date IS NULL AND eg2.group_id = ${filter.groupId}
    )`)
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

export async function getShiftsTable(
  filter: ShiftFilterParams,
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<ShiftWithEmployee>> {
  // @db.Date カラムとの比較は UTC 基準で行われるため、
  // ローカル時刻ではなく UTC midnight で日付を生成する
  const startDate = new Date(Date.UTC(filter.year, filter.month - 1, 1))
  const endDate = new Date(Date.UTC(filter.year, filter.month, 0))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    shiftDate: {
      gte: startDate,
      lte: endDate,
    },
  }

  if (filter.unassigned) {
    where.employee = { groups: { none: { endDate: null } } }
  } else if (filter.groupId) {
    where.employee = { groups: { some: { groupId: filter.groupId, endDate: null } } }
  }

  if (filter.employeeSearch) {
    where.employee = {
      ...(where.employee ?? {}),
      OR: [
        { name: { contains: filter.employeeSearch, mode: "insensitive" } },
        { nameKana: { contains: filter.employeeSearch, mode: "insensitive" } },
      ],
    }
  }

  const [data, total] = await Promise.all([
    prisma.shift.findMany({
      where,
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
      orderBy: [{ shiftDate: "asc" }, { employee: { name: "asc" } }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.shift.count({ where }),
  ])

  return {
    data: data as ShiftWithEmployee[],
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
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
}

export async function getLatestShiftHistoryEntries(
  year: number,
  month: number
): Promise<Record<number, LatestShiftHistory>> {
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0))

  const records = await prisma.$queryRaw<
    { shift_id: number; shift_code: string | null; new_shift_code: string | null; note: string | null }[]
  >`
    SELECT DISTINCT ON (shift_id) shift_id, shift_code, new_shift_code, note
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
