"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CsvFileInput } from "@/components/csv-import/csv-file-input"
import { CsvPreviewTable } from "@/components/csv-import/csv-preview-table"
import { parseShiftCsv, type ParsedShiftRow } from "@/lib/csv/parse-shift-csv"
import { importShifts } from "@/lib/actions/shift-actions"

type Step = "select" | "preview" | "importing" | "result"

export function ShiftImportDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedShiftRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [result, setResult] = useState<{ created: number; updated: number; errors: Array<{ rowIndex: number; error: string }> }>()

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setResult(undefined)
  }

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (value) resetState()
  }

  function handleFileLoaded(csvText: string) {
    const parsed = parseShiftCsv(csvText)
    if (!parsed.headerValid) {
      setHeaderError(parsed.headerError)
      setParsedRows([])
      return
    }
    setHeaderError(undefined)
    setParsedRows(parsed.rows)
    setStep("preview")
  }

  async function handleImport() {
    const validRows = parsedRows.filter((r) => r.valid)
    if (validRows.length === 0) {
      toast.error("インポートできる有効な行がありません")
      return
    }

    setStep("importing")

    const rows = validRows.map((r) => ({
      rowIndex: r.rowIndex,
      shiftDate: r.data.shiftDate,
      employeeId: r.data.employeeId,
      shiftCode: r.data.shiftCode,
      startTime: r.data.startTime,
      endTime: r.data.endTime,
      isHoliday: r.data.isHoliday,
      isPaidLeave: r.data.isPaidLeave,
      isRemote: r.data.isRemote,
    }))

    const res = await importShifts(rows)
    setResult(res)
    setStep("result")

    if (res.success) {
      toast.success(`インポート完了: 新規${res.created}件、更新${res.updated}件`)
    } else {
      toast.error("インポートに失敗しました")
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const errorCount = parsedRows.filter((r) => !r.valid).length

  const previewHeaders = ["日付", "従業員ID", "従業員名", "シフトコード", "開始", "終了", "休日", "有給", "テレワーク"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.shiftDate,
      r.data.employeeId.toString(),
      r.data._employeeName || "",
      r.data.shiftCode || "",
      r.data.startTime || "-",
      r.data.endTime || "-",
      r.data.isHoliday ? "○" : "",
      r.data.isPaidLeave ? "○" : "",
      r.data.isRemote ? "○" : "",
    ],
    valid: r.valid,
    error: r.error,
  }))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-1 h-4 w-4" />
          CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>シフトCSVインポート</DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>エクスポートしたCSVファイルと同じ形式で読み込めます。</p>
              <p>同じ従業員・日付のシフトが存在する場合は上書き更新します。</p>
            </div>
            <CsvFileInput onFileLoaded={handleFileLoaded} />
            {headerError && (
              <p className="text-sm text-red-600">{headerError}</p>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 min-w-0">
            <CsvPreviewTable headers={previewHeaders} rows={previewRows} />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={resetState}>
                ファイルを再選択
              </Button>
              <div className="flex items-center gap-2">
                {errorCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    有効な{validCount}件のみインポートします
                  </p>
                )}
                <Button onClick={handleImport} disabled={validCount === 0}>
                  インポート実行
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="py-8 text-center text-muted-foreground">
            インポート中...
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <p>新規作成: {result.created}件</p>
              <p>更新: {result.updated}件</p>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-red-600">エラー: {result.errors.length}件</p>
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">
                      {e.rowIndex > 0 ? `${e.rowIndex}行目: ` : ""}{e.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>閉じる</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
