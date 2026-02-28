"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
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
import { parseEmployeeCsv, type ParsedEmployeeRow } from "@/lib/csv/parse-employee-csv"
import { importEmployees } from "@/lib/actions/employee-actions"

type Step = "select" | "preview" | "importing" | "result"

export function EmployeeImportDialog() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([])
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
    const parsed = parseEmployeeCsv(csvText)
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
      employeeId: r.data.employeeId,
      name: r.data.name,
      nameKana: r.data.nameKana,
      hireDate: r.data.hireDate,
      terminationDate: r.data.terminationDate,
    }))

    const res = await importEmployees(rows)
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

  const previewHeaders = ["従業員ID", "従業員名", "フリガナ", "入社日", "退職日"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.employeeId?.toString() || "(新規)",
      r.data.name,
      r.data.nameKana || "",
      r.data.hireDate || "",
      r.data.terminationDate || "",
    ],
    valid: r.valid,
    error: r.error,
  }))

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-1 h-4 w-4" />
          CSVインポート
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>従業員CSVインポート</DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>CSV形式: 従業員ID, 従業員名, フリガナ, 入社日, 退職日</p>
              <p>従業員IDが空欄の場合は新規作成、値がある場合は既存データを更新します。</p>
              <p>日付形式: yyyy/MM/dd</p>
            </div>
            <CsvFileInput onFileLoaded={handleFileLoaded} />
            {headerError && (
              <p className="text-sm text-red-600">{headerError}</p>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
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
