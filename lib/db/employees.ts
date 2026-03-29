import { prisma } from "@/lib/prisma"
import { getTodayJST } from "@/lib/date-utils"
import type { EmployeeFilterParams, PaginationParams, PaginatedResult } from "@/types"
import type { EmployeeWithGroups, EmployeeWithDetails } from "@/types/employees"

/** EmployeeGroup 用 Prisma where 条件（startDate NOT NULL） */
function currentGroupDateWhere(today: Date) {
  return {
    startDate: { lte: today },
    OR: [{ endDate: null }, { endDate: { gte: today } }],
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

export async function getEmployees(
  filter: EmployeeFilterParams = {},
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResult<EmployeeWithGroups>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  const today = getTodayJST()

  const conditions: object[] = []

  if (filter.search) {
    conditions.push({
      OR: [
        { name: { contains: filter.search, mode: "insensitive" } },
        { nameKana: { contains: filter.search, mode: "insensitive" } },
      ],
    })
  }

  // グループフィルター（OR結合）
  const groupConditions: object[] = []
  if (filter.groupIds?.length) {
    groupConditions.push({ groups: { some: { groupId: { in: filter.groupIds }, ...currentGroupDateWhere(today) } } })
  }
  if (filter.noGroup) {
    groupConditions.push({ groups: { none: currentGroupDateWhere(today) } })
  }
  if (groupConditions.length === 1) conditions.push(groupConditions[0])
  else if (groupConditions.length > 1) conditions.push({ OR: groupConditions })

  // ロールフィルター（OR結合）
  const roleConditions: object[] = []
  if (filter.roleIds?.length) {
    roleConditions.push({ functionRoles: { some: { functionRoleId: { in: filter.roleIds }, ...currentRoleDateWhere(today) } } })
  }
  if (filter.roleUnassigned) {
    roleConditions.push({ functionRoles: { none: currentRoleDateWhere(today) } })
  }
  if (roleConditions.length === 1) conditions.push(roleConditions[0])
  else if (roleConditions.length > 1) conditions.push({ OR: roleConditions })

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
          where: {
            startDate: { lte: today },
            OR: [{ endDate: null }, { endDate: { gte: today } }],
          },
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

export async function getEmployeeById(id: string): Promise<EmployeeWithDetails | null> {
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
  const today = getTodayJST()
  return prisma.employee.findMany({
    include: {
      groups: {
        include: { group: true },
        where: {
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
      },
    },
    orderBy: [{ name: "asc" }],
  })
}

export async function getEmployeesForExport(
  filter: { groupId?: number; activeOnly?: boolean } = {}
) {
  const today = getTodayJST()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  const conditions: object[] = []

  if (filter.groupId) {
    conditions.push({
      groups: { some: { groupId: filter.groupId, ...currentGroupDateWhere(today) } },
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

  return prisma.employee.findMany({
    where,
    include: {
      groups: {
        include: { group: true },
        where: {
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
      },
    },
    orderBy: [{ name: "asc" }],
  })
}
