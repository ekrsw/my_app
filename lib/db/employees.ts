import { prisma } from "@/lib/prisma"
import type { EmployeeFilterParams, PaginationParams, PaginatedResult } from "@/types"
import type { EmployeeWithGroup, EmployeeWithDetails } from "@/types/employees"

export async function getEmployees(
  filter: EmployeeFilterParams = {},
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<EmployeeWithGroup>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const conditions: object[] = []

  if (filter.search) {
    conditions.push({
      OR: [
        { name: { contains: filter.search, mode: "insensitive" } },
        { nameKana: { contains: filter.search, mode: "insensitive" } },
      ],
    })
  }

  if (filter.groupId) {
    conditions.push({ groupId: filter.groupId })
  }

  if (filter.activeOnly) {
    conditions.push({
      OR: [
        { terminationDate: null },
        { terminationDate: { gte: today } },
      ],
    })
  }

  if (conditions.length > 0) {
    where.AND = conditions
  }

  const [data, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: { group: true },
      orderBy: [{ groupId: "asc" }, { name: "asc" }],
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.employee.count({ where }),
  ])

  return {
    data,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  }
}

export async function getEmployeeById(id: number): Promise<EmployeeWithDetails | null> {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      group: true,
      functionRoles: {
        include: { functionRole: true },
        orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
      },
      nameHistory: {
        orderBy: { validFrom: "desc" },
      },
      groupHistory: {
        include: { group: true },
        orderBy: { changedAt: "desc" },
      },
    },
  }) as Promise<EmployeeWithDetails | null>
}

export async function getAllEmployees() {
  return prisma.employee.findMany({
    include: { group: true },
    orderBy: [{ groupId: "asc" }, { name: "asc" }],
  })
}
