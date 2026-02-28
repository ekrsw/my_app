import { prisma } from "@/lib/prisma"
import type { EmployeeFilterParams, PaginationParams, PaginatedResult } from "@/types"
import type { EmployeeWithGroups, EmployeeWithDetails } from "@/types/employees"

export async function getEmployees(
  filter: EmployeeFilterParams = {},
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<EmployeeWithGroups>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  // @db.Date カラムとの比較は UTC 基準のため、ローカル日付を UTC midnight に変換
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

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
    conditions.push({
      groups: { some: { groupId: filter.groupId, endDate: null } },
    })
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
      include: {
        groups: {
          include: { group: true },
          where: { endDate: null },
        },
      },
      orderBy: [{ name: "asc" }],
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
      groups: {
        include: { group: true },
        orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
      },
      functionRoles: {
        include: { functionRole: true },
        orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
      },
      positions: {
        include: { position: true },
        orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
      },
      groupHistory: {
        include: { group: true },
        orderBy: { changedAt: "desc" },
      },
      roleHistory: {
        orderBy: { changedAt: "desc" },
      },
      positionHistory: {
        orderBy: { changedAt: "desc" },
      },
    },
  }) as Promise<EmployeeWithDetails | null>
}

export async function getAllEmployees() {
  return prisma.employee.findMany({
    include: {
      groups: {
        include: { group: true },
        where: { endDate: null },
      },
    },
    orderBy: [{ name: "asc" }],
  })
}

export async function getEmployeesForExport(
  filter: { groupId?: number; activeOnly?: boolean } = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  const conditions: object[] = []

  if (filter.groupId) {
    conditions.push({
      groups: { some: { groupId: filter.groupId, endDate: null } },
    })
  }

  if (filter.activeOnly) {
    const now = new Date()
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
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

  return prisma.employee.findMany({
    where,
    include: {
      groups: {
        include: { group: true },
        where: { endDate: null },
      },
    },
    orderBy: [{ name: "asc" }],
  })
}
