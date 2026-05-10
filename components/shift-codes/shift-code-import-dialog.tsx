"use client"

import { useState } from "react"
import { Download, Info } from "lucide-react"
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
import { parseShiftCodeCsv, type ParsedShiftCodeRow } from "@/lib/csv/parse-shift-code-csv"
import { importShiftCodes } from "@/lib/actions/shift-code-actions"

type Step = "select" | "preview" | "importing" | "result"

export function ShiftCodeImportDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedShiftCodeRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [lunchBreakColumnsMissing, setLunchBreakColumnsMissing] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; errors: Array<{ rowIndex: number; error: string }> }>()

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setLunchBreakColumnsMissing(false)
    setResult(undefined)
  }

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (value) resetState()
  }

  function handleFileLoaded(csvText: string) {
    const parsed = parseShiftCodeCsv(csvText)
    if (!parsed.headerValid) {
      setHeaderError(parsed.headerError)
      setParsedRows([])
      setLunchBreakColumnsMissing(false)
      return
    }
    setHeaderError(undefined)
    setParsedRows(parsed.rows)
    setLunchBreakColumnsMissing(parsed.lunchBreakColumnsMissing)
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
      code: r.data.code,
      color: r.data.color,
      defaultStartTime: r.data.defaultStartTime,
      defaultEndTime: r.data.defaultEndTime,
      defaultIsHoliday: r.data.defaultIsHoliday,
      isActive: r.data.isActive,
      sortOrder: r.data.sortOrder,
      defaultLunchBreakStart: r.data.defaultLunchBreakStart,
      defaultLunchBreakEnd: r.data.defaultLunchBreakEnd,
    }))

    const res = await importShiftCodes(rows, lunchBreakColumnsMissing)
    setResult(res)
    setStep("result")

    if (res.success) {
      toast.success(`インポート完了: 新規${res.created}件、更新${res.updated}件`)
    } else {
      toast.error("インポートに失敗しました")
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length

  const previewHeaders = ["シフトコード", "カラー", "開始時刻", "終了時刻", "休日", "有効", "表示順", "昼休憩開始", "昼休憩終了"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.code,
      r.data.color || "",
      r.data.defaultStartTime || "—",
      r.data.defaultEndTime || "—",
      r.data.defaultIsHoliday ? "○" : "×",
      r.data.isActive ? "○" : "×",
      String(r.data.sortOrder),
      r.data.defaultLunchBreakStart || "—",
      r.data.defaultLunchBreakEnd || "—",
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
          <DialogTitle>シフトコードCSVインポート</DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>CSV形式: シフトコード, カラー, 開始時刻, 終了時刻, 休日, 有効, 表示順, 昼休憩開始, 昼休憩終了</p>
              <p>シフトコードが既存の場合は上書き更新、未存在の場合は新規作成されます。</p>
              <p>時刻形式: HH:mm　休日・有効: true/false/○/×</p>
              <p>昼休憩列を含まない旧フォーマットも読み込めます（既存値は保持されます）。</p>
            </div>
            <CsvFileInput onFileLoaded={handleFileLoaded} />
            {headerError && (
              <p className="text-sm text-red-600">{headerError}</p>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 min-w-0">
            {lunchBreakColumnsMissing && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground"
              >
                <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>昼休憩列が見つかりません。既存シフトコードの昼休憩は変更されません。</p>
              </div>
            )}
            <CsvPreviewTable headers={previewHeaders} rows={previewRows} />
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={resetState}>
                ファイルを再選択
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                インポート実行
              </Button>
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
