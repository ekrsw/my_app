"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { importLogSchema, type ImportTargetType } from "@/lib/validators"
import { getImportLogs, type ImportLogFilter } from "@/lib/db/import-logs"
import type { PaginationParams } from "@/types"

/**
 * インポート実施ログを1件記録する。
 * CSV等のインポート1回につき1度だけ呼ぶ（クライアントのチャンクループ完了後の finally）。
 * 実行者名はサーバ側のセッションから取得する（クライアントからは受け取らない）。
 */
export async function recordImportLog(data: {
  targetType: ImportTargetType
  fileName?: string | null
  createdCount: number
  updatedCount: number
  errorCount: number
}) {
  const session = await requireAuth()
  const parsed = importLogSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.importLog.create({
      data: {
        targetType: parsed.data.targetType,
        fileName: parsed.data.fileName ?? null,
        createdCount: parsed.data.createdCount,
        updatedCount: parsed.data.updatedCount,
        errorCount: parsed.data.errorCount,
        importedBy: session.user?.name ?? null,
      },
    })
    return { success: true }
  } catch {
    return { error: "インポートログの記録に失敗しました" }
  }
}

/**
 * 取り込み履歴の一覧取得（読み取りは認証不要、他の閲覧系と同様）。
 * クライアントコンポーネントから呼べるよう Server Action として公開する。
 */
export async function fetchImportLogs(
  pagination: PaginationParams,
  filter?: ImportLogFilter
) {
  try {
    const data = await getImportLogs(pagination, filter)
    return { data }
  } catch {
    return {
      data: { data: [], total: 0, page: 1, pageSize: pagination.pageSize, totalPages: 0 },
      error: "取り込み履歴の取得に失敗しました",
    }
  }
}
