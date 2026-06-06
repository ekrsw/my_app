"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { fetchImportLogs } from "@/lib/actions/import-log-actions"
import type { ImportTargetType } from "@/lib/validators"

type ImportLogRow = {
  id: number
  targetType: string
  fileName: string | null
  createdCount: number
  updatedCount: number
  errorCount: number
  importedBy: string | null
  importedAt: string | Date
}

const TARGET_LABELS: Record<string, string> = {
  shifts: "シフト管理",
  employees: "従業員",
  roles: "ロール割当て",
  dutyTypes: "業務種別マスタ",
  dutyAssignments: "業務割当",
  shiftCodes: "シフトコード",
}

const PAGE_SIZE = 20

function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ImportLogHistorySection({ targetType }: { targetType: ImportTargetType }) {
  const [rows, setRows] = useState<ImportLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // 取得は promise チェーンの中で setState する（effect 本体での同期 setState を避ける）。
  // targetType 変更時のページリセットは親側の key による再マウントで行う。
  useEffect(() => {
    let cancelled = false
    fetchImportLogs({ page, pageSize: PAGE_SIZE }, { targetType })
      .then((res) => {
        if (cancelled) return
        setRows(res.data.data as ImportLogRow[])
        setTotal(res.data.total)
        setTotalPages(res.data.totalPages)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, targetType])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          取り込み履歴（{TARGET_LABELS[targetType] ?? targetType}）
        </h3>
        <p className="text-sm text-muted-foreground">{total}件</p>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          取り込み履歴はまだありません
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日時</TableHead>
                  <TableHead>実行者</TableHead>
                  <TableHead>ファイル</TableHead>
                  <TableHead className="text-right">新規</TableHead>
                  <TableHead className="text-right">更新</TableHead>
                  <TableHead className="text-right">エラー</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(log.importedAt)}</TableCell>
                    <TableCell>{log.importedBy ?? "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{log.fileName ?? "-"}</TableCell>
                    <TableCell className="text-right">{log.createdCount}</TableCell>
                    <TableCell className="text-right">{log.updatedCount}</TableCell>
                    <TableCell className={`text-right ${log.errorCount > 0 ? "text-red-600" : ""}`}>
                      {log.errorCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                前へ
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                次へ
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
