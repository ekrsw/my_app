"use client"

import { useState } from "react"
import { toast } from "sonner"
import { parseDutyTypeCsv, type ParsedDutyTypeRow } from "@/lib/csv/parse-duty-type-csv"
import { importDutyTypes } from "@/lib/actions/duty-type-actions"

type Step = "select" | "preview" | "importing" | "result"

type ImportResult = {
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export function useDutyTypeImport() {
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedDutyTypeRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [result, setResult] = useState<ImportResult>()

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setResult(undefined)
  }

  function handleFileLoaded(csvText: string) {
    const parsed = parseDutyTypeCsv(csvText)
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
      name: r.data.name,
      color: r.data.color,
      isActive: r.data.isActive,
      sortOrder: r.data.sortOrder,
      defaultReducesCapacity: r.data.defaultReducesCapacity,
      defaultStartTime: r.data.defaultStartTime,
      defaultEndTime: r.data.defaultEndTime,
      defaultTitle: r.data.defaultTitle,
      defaultNote: r.data.defaultNote,
    }))

    try {
      const res = await importDutyTypes(rows)
      setResult(res)
      setStep("result")

      if (res.errors.length === 0) {
        toast.success(`インポート完了: 新規${res.created}件、更新${res.updated}件`)
      } else {
        toast.error("一部のインポートに失敗しました")
      }
    } catch {
      setResult({
        created: 0,
        updated: 0,
        errors: [{ rowIndex: 0, error: "サーバーとの通信に失敗しました" }],
      })
      setStep("result")
      toast.error("インポートに失敗しました")
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const errorCount = parsedRows.filter((r) => !r.valid).length

  const previewHeaders = ["業務名", "色", "有効", "表示順", "キャパ減少", "開始時刻", "終了時刻", "タイトル", "メモ"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.name,
      r.data.color || "",
      r.data.isActive ? "true" : "false",
      String(r.data.sortOrder),
      r.data.defaultReducesCapacity ? "true" : "false",
      r.data.defaultStartTime || "-",
      r.data.defaultEndTime || "-",
      r.data.defaultTitle || "",
      r.data.defaultNote || "",
    ],
    valid: r.valid,
    error: r.error,
  }))

  return {
    step,
    headerError,
    result,
    validCount,
    errorCount,
    previewHeaders,
    previewRows,
    resetState,
    handleFileLoaded,
    handleImport,
  }
}
