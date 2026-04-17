"use client"

import { useState } from "react"
import { toast } from "sonner"
import { parseRoleCsv, type ParsedRoleRow } from "@/lib/csv/parse-role-csv"
import { importRoleAssignments } from "@/lib/actions/role-actions"

type Step = "select" | "preview" | "importing" | "result"

type ImportResult = {
  success: boolean
  created: number
  errors: Array<{ rowIndex: number; error: string }>
}

export function useRoleImport() {
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedRoleRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [result, setResult] = useState<ImportResult>()

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setResult(undefined)
  }

  function handleFileLoaded(csvText: string) {
    const parsed = parseRoleCsv(csvText)
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
      employeeName: r.data.employeeName,
      roleCode: r.data.roleCode,
      isPrimary: r.data.isPrimary,
      startDate: r.data.startDate,
      endDate: r.data.endDate,
    }))

    try {
      const res = await importRoleAssignments(rows)
      setResult(res)
      setStep("result")

      if (res.errors.length === 0) {
        toast.success(`インポート完了: ${res.created}件作成`)
      } else {
        toast.error("一部のインポートに失敗しました")
      }
    } catch {
      setResult({
        success: false,
        created: 0,
        errors: [{ rowIndex: 0, error: "サーバーとの通信に失敗しました" }],
      })
      setStep("result")
      toast.error("インポートに失敗しました")
    }
  }

  const validCount = parsedRows.filter((r) => r.valid).length
  const errorCount = parsedRows.filter((r) => !r.valid).length

  const previewHeaders = ["従業員名", "ロールコード", "主担当", "開始日", "終了日"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.employeeName,
      r.data.roleCode,
      r.data.isPrimary ? "true" : "false",
      r.data.startDate || "",
      r.data.endDate || "",
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
