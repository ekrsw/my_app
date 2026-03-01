import { prisma } from "@/lib/prisma"
import type { PaginationParams, PaginatedResult } from "@/types"
import type { ShiftHistoryEntry } from "@/types/shifts"

export async function getShiftHistory(
  pagination: PaginationParams = { page: 1, pageSize: 20 },
  shiftId?: number,
  employeeId?: string
): Promise<PaginatedResult<ShiftHistoryEntry>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (shiftId) {
    where.shiftId = shiftId
  }

  if (employeeId) {
    where.employeeId = employeeId
  }

  const [data, total] = await Promise.all([
    prisma.shiftChangeHistory.findMany({
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
      orderBy: { changedAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.shiftChangeHistory.count({ where }),
  ])

  return {
    data: data as ShiftHistoryEntry[],
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  }
}

export async function getShiftVersions(shiftId: number) {
  return prisma.shiftChangeHistory.findMany({
    where: { shiftId },
    orderBy: { version: "desc" },
  })
}
