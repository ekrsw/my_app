"use client"

import { useState } from "react"
import { toast } from "sonner"
import { parseDutyAssignmentCsv, type ParsedDutyAssignmentRow } from "@/lib/csv/parse-duty-assignment-csv"
import { importDutyAssignments } from "@/lib/actions/duty-assignment-actions"

type Step = "select" | "preview" | "importing" | "result"

type ImportResult = {
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export function useDutyAssignmentImport() {
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedDutyAssignmentRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [result, setResult] = useState<ImportResult>()

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setResult(undefined)
  }

  function handleFileLoaded(csvText: string) {
    const parsed = parseDutyAssignmentCsv(csvText)
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
      dutyDate: r.data.dutyDate,
      employeeName: r.data.employeeName,
      dutyTypeName: r.data.dutyTypeName,
      startTime: r.data.startTime,
      endTime: r.data.endTime,
      title: r.data.title,
      note: r.data.note,
      reducesCapacity: r.data.reducesCapacity,
    }))

    try {
      const res = await importDutyAssignments(rows)
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

  const previewHeaders = ["日付", "従業員名", "業務種別", "開始時刻", "終了時刻", "タイトル", "メモ", "キャパ減少"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.dutyDate,
      r.data.employeeName,
      r.data.dutyTypeName,
      r.data.startTime || "-",
      r.data.endTime || "-",
      r.data.title || "",
      r.data.note || "",
      r.data.reducesCapacity ? "true" : "false",
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
