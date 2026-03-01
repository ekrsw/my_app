import { prisma } from "@/lib/prisma"

export async function getFunctionRoles(roleType?: string) {
  const where = roleType ? { roleType } : {}
  return prisma.functionRole.findMany({
    where,
    include: {
      _count: {
        select: {
          employeeRoles: {
            where: { endDate: null },
          },
        },
      },
    },
    orderBy: [{ roleType: "asc" }, { id: "asc" }],
  })
}

export async function getFunctionRoleById(id: number) {
  return prisma.functionRole.findUnique({
    where: { id },
    include: {
      employeeRoles: {
        where: { endDate: null },
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
        orderBy: { employee: { name: "asc" } },
      },
    },
  })
}

export async function getEmployeeFunctionRoles(employeeId: string) {
  return prisma.employeeFunctionRole.findMany({
    where: { employeeId },
    include: { functionRole: true },
    orderBy: [{ endDate: "asc" }, { startDate: "desc" }],
  })
}
