import { prisma } from "@/lib/prisma"
import type { ShiftFilterParams, PaginationParams, PaginatedResult } from "@/types"
import type { ShiftWithEmployee, ShiftCalendarData } from "@/types/shifts"
import { toDateString } from "@/lib/date-utils"

export async function getShiftsForCalendar(
  filter: ShiftFilterParams
): Promise<ShiftCalendarData[]> {
  const startDate = new Date(filter.year, filter.month - 1, 1)
  const endDate = new Date(filter.year, filter.month, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employeeWhere: any = {}

  if (filter.groupId) {
    employeeWhere.groupId = filter.groupId
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
      group: true,
      shifts: {
        where: {
          shiftDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
    },
    orderBy: [{ groupId: "asc" }, { name: "asc" }],
  })

  return employees.map((emp) => ({
    employeeId: emp.id,
    employeeName: emp.name,
    groupId: emp.groupId,
    groupName: emp.group?.name ?? null,
    shifts: Object.fromEntries(
      emp.shifts.map((s) => [toDateString(s.shiftDate), s])
    ),
  }))
}

export async function getShiftsTable(
  filter: ShiftFilterParams,
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<ShiftWithEmployee>> {
  const startDate = new Date(filter.year, filter.month - 1, 1)
  const endDate = new Date(filter.year, filter.month, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    shiftDate: {
      gte: startDate,
      lte: endDate,
    },
  }

  if (filter.groupId) {
    where.employee = { groupId: filter.groupId }
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
        employee: { include: { group: true } },
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
      employee: { include: { group: true } },
    },
  })
}
