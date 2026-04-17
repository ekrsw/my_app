"use client"

import { useState } from "react"
import { toast } from "sonner"
import { parseEmployeeCsv, type ParsedEmployeeRow } from "@/lib/csv/parse-employee-csv"
import { importEmployees } from "@/lib/actions/employee-actions"

type Step = "select" | "preview" | "importing" | "result"

type ImportResult = {
  success: boolean
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export function useEmployeeImport() {
  const [step, setStep] = useState<Step>("select")
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([])
  const [headerError, setHeaderError] = useState<string>()
  const [result, setResult] = useState<ImportResult>()

  function resetState() {
    setStep("select")
    setParsedRows([])
    setHeaderError(undefined)
    setResult(undefined)
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
      groupNames: r.data.groupNames,
    }))

    try {
      const res = await importEmployees(rows)
      setResult(res)
      setStep("result")

      if (res.errors.length === 0) {
        toast.success(`インポート完了: 新規${res.created}件、更新${res.updated}件`)
      } else {
        toast.error("一部のインポートに失敗しました")
      }
    } catch {
      setResult({
        success: false,
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

  const previewHeaders = ["従業員ID", "従業員名", "フリガナ", "入社日", "退職日", "グループ"]
  const previewRows = parsedRows.map((r) => ({
    rowIndex: r.rowIndex,
    cells: [
      r.data.employeeId?.toString() || "(新規)",
      r.data.name,
      r.data.nameKana || "",
      r.data.hireDate || "",
      r.data.terminationDate || "",
      r.data.groupNames || "",
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
