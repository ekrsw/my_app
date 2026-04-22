"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  SHIFT_CONVERSION_MAX_BYTES,
  SHIFT_CONVERSION_MAX_MB,
  type ShiftConversionSuccessResponse,
  type ValidationResult,
} from "@/types/shift-conversion"

type Step = "idle" | "validating" | "validated" | "blocked" | "downloading" | "done"

export function useShiftConversion() {
  const [step, setStep] = useState<Step>("idle")
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sourceFileName, setSourceFileName] = useState<string | null>(null)

  // CSV 本体とダウンロード時ファイル名はフック内部だけで使う。
  // 外部に晒すと hook の契約が広がり、メモリに大きな文字列を保持し続けることになる。
  const csvRef = useRef<{ csvContent: string; filename: string } | null>(null)

  function resetState() {
    setStep("idle")
    setValidation(null)
    setErrorMessage(null)
    setSourceFileName(null)
    csvRef.current = null
  }

  async function handleFile(file: File) {
    resetState()
    setSourceFileName(file.name)

    // クライアント側のプレチェック
    if (!/\.xlsx$/i.test(file.name)) {
      setErrorMessage(".xlsx 形式のファイルを選択してください")
      setStep("blocked")
      return
    }
    if (file.size > SHIFT_CONVERSION_MAX_BYTES) {
      setErrorMessage(
        `ファイルサイズが上限 (${SHIFT_CONVERSION_MAX_MB}MB) を超えています`,
      )
      setStep("blocked")
      return
    }

    setStep("validating")

    const fd = new FormData()
    fd.append("file", file)

    let res: Response
    try {
      res = await fetch("/api/data/shift-conversion", {
        method: "POST",
        body: fd,
      })
    } catch {
      setErrorMessage("サーバーとの通信に失敗しました")
      setStep("blocked")
      toast.error("変換に失敗しました")
      return
    }

    if (res.status === 200) {
      const body: ShiftConversionSuccessResponse = await res.json()
      setValidation(body.validation)
      csvRef.current = { csvContent: body.csvContent, filename: body.filename }
      setStep("validated")
      return
    }

    if (res.status === 422) {
      const body: { validation?: ValidationResult; error?: string } = await res
        .json()
        .catch(() => ({}))
      if (body.validation) {
        setValidation(body.validation)
      } else {
        setErrorMessage(body.error ?? "検証に失敗しました")
      }
      setStep("blocked")
      return
    }

    const body: { error?: string } = await res.json().catch(() => ({}))
    setErrorMessage(body.error ?? `リクエストが失敗しました (status=${res.status})`)
    setStep("blocked")
    toast.error("変換に失敗しました")
  }

  function downloadCsv() {
    if (!csvRef.current) return
    const { csvContent, filename } = csvRef.current
    setStep("downloading")
    try {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Safari/Firefox のダウンロードダイアログが開いている間に blob URL を
      // 無効化すると 0 バイトで保存されることがあるため、少し遅延させる。
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setStep("done")
      toast.success(`${filename} をダウンロードしました`)
    } catch (e) {
      setErrorMessage(
        e instanceof Error ? e.message : "ダウンロードに失敗しました",
      )
      setStep("blocked")
      toast.error("ダウンロードに失敗しました")
    }
  }

  return {
    step,
    validation,
    errorMessage,
    sourceFileName,
    handleFile,
    downloadCsv,
    resetState,
  }
}
