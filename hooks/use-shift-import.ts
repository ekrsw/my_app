"use client"

import { useState } from "react"
import { toast } from "sonner"
import { parseShiftCsv, type ParsedShiftRow } from "@/lib/csv/parse-shift-csv"
import { importShifts } from "@/lib/actions/shift-actions"

type Step = "select" | "preview" | "importing" | "result"

type ImportResult = {
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

const CLIENT_CHUNK_SIZE = 2000

export function useShiftImport() {
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedShiftRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [result, setResult] = useState<ImportResult>()
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setResult(undefined)
    setProgress(null)
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
      employeeName: r.data._employeeName || undefined,
      shiftCode: r.data.shiftCode,
      startTime: r.data.startTime,
      endTime: r.data.endTime,
      isHoliday: r.data.isHoliday,
      isRemote: r.data.isRemote,
    }))

    let totalCreated = 0
    let totalUpdated = 0
    const allErrors: Array<{ rowIndex: number; error: string }> = []

    try {
      for (let i = 0; i < rows.length; i += CLIENT_CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CLIENT_CHUNK_SIZE)
        setProgress({ current: i, total: rows.length })

        const res = await importShifts(chunk)
        totalCreated += res.created
        totalUpdated += res.updated
        allErrors.push(...res.errors)
      }

      setProgress(null)
      setResult({ created: totalCreated, updated: totalUpdated, errors: allErrors })
      setStep("result")

      if (allErrors.length === 0) {
        toast.success(`インポート完了: 新規${totalCreated}件、更新${totalUpdated}件`)
      } else {
        toast.error("一部のインポートに失敗しました")
      }
    } catch {
      setProgress(null)
      setResult({
        created: totalCreated,
        updated: totalUpdated,
        errors: [...allErrors, { rowIndex: 0, error: "サーバーとの通信に失敗しました" }],
      })
      setStep("result")
      toast.error("インポートに失敗しました")
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const errorCount = parsedRows.filter((r) => !r.valid).length

  const previewHeaders = ["日付", "従業員ID", "従業員名", "シフトコード", "開始", "終了", "休日", "テレワーク"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.shiftDate,
      r.data.employeeId.toString(),
      r.data._employeeName || "",
      r.data.shiftCode || "",
      r.data.startTime || "-",
      r.data.endTime || "-",
      r.data.isHoliday ? "t" : "f",
      r.data.isRemote ? "t" : "f",
    ],
    valid: r.valid,
    error: r.error,
  }))

  return {
    step,
    parsedRows,
    headerError,
    result,
    progress,
    validCount,
    errorCount,
    previewHeaders,
    previewRows,
    resetState,
    handleFileLoaded,
    handleImport,
    CLIENT_CHUNK_SIZE,
  }
}
