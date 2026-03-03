import { prisma } from "@/lib/prisma"
import type { PaginationParams, PaginatedResult } from "@/types"
import type { ShiftHistoryEntry } from "@/types/shifts"

export type ShiftHistoryFilter = {
  shiftId?: number
  employeeId?: string
  shiftDate?: string      // "yyyy-MM-dd" 形式
  employeeName?: string   // name/nameKana 部分一致
}

export async function getShiftHistory(
  pagination: PaginationParams = { page: 1, pageSize: 20 },
  filter?: ShiftHistoryFilter
): Promise<PaginatedResult<ShiftHistoryEntry>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (filter?.shiftId) {
    where.shiftId = filter.shiftId
  }

  if (filter?.employeeId) {
    where.employeeId = filter.employeeId
  }

  if (filter?.shiftDate) {
    where.shiftDate = new Date(filter.shiftDate)
  }

  if (filter?.employeeName) {
    where.employee = {
      OR: [
        { name: { contains: filter.employeeName } },
        { nameKana: { contains: filter.employeeName } },
      ],
    }
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

export async function getShiftHistoryById(id: number) {
  return prisma.shiftChangeHistory.findFirst({
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
  }) as Promise<ShiftHistoryEntry | null>
}

export async function getShiftVersions(shiftId: number) {
  return prisma.shiftChangeHistory.findMany({
    where: { shiftId },
    orderBy: { version: "desc" },
  })
}
