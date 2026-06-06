import { prisma } from "@/lib/prisma"
import type { PaginationParams, PaginatedResult } from "@/types"
import type { ImportTargetType } from "@/lib/validators"
import type { ImportLog } from "@/app/generated/prisma/client"

export type ImportLogFilter = {
  targetType?: ImportTargetType
}

export async function getImportLogs(
  pagination: PaginationParams = { page: 1, pageSize: 20 },
  filter?: ImportLogFilter
): Promise<PaginatedResult<ImportLog>> {
  const where = filter?.targetType ? { targetType: filter.targetType } : {}

  const [data, total] = await Promise.all([
    prisma.importLog.findMany({
      where,
      orderBy: { importedAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.importLog.count({ where }),
  ])

  return {
    data,
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(total / pagination.pageSize),
  }
}
