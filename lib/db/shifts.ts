import { prisma } from "@/lib/prisma"
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

  if (filter.groupId) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {}

  if (filter.groupId) {
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

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
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
      skip: cursor,
      take: pageSize + 1,
    }),
    prisma.employee.count({ where }),
  ])

  const hasMore = employees.length > pageSize
  const sliced = hasMore ? employees.slice(0, pageSize) : employees

  return {
    data: sliced.map((emp) => ({
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

  if (filter.groupId) {
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
