"use client"

import { useRef } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Download, FileSpreadsheet, LogIn, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useShiftConversion } from "@/hooks/use-shift-conversion"

export function ShiftConversionSection() {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user

  const inputRef = useRef<HTMLInputElement>(null)

  const {
    step,
    validation,
    errorMessage,
    sourceFileName,
    handleFile,
    downloadCsv,
    resetState,
  } = useShiftConversion()

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          Excel→CSV変換には管理者ログインが必要です
        </p>
      </div>
    )
  }

  function resetAndRestart() {
    resetState()
    if (inputRef.current) inputRef.current.value = ""
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    await handleFile(f)
    // 同じファイルを再選択できるようリセット
    if (inputRef.current) inputRef.current.value = ""
  }

  const isBusy = step === "validating" || step === "downloading"

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">シフトExcel→CSV変換</h3>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>現場で作成したシフト表Excel (.xlsx) を、本システムが取り込めるCSVに変換します。</p>
        <p>
          変換したCSVは「インポート」モードの「シフト管理」で取り込みます。
        </p>
      </div>

      {step === "idle" && (
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            onChange={onFileChange}
            className="hidden"
            disabled={isBusy}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            Excelファイルを選択
          </Button>
        </div>
      )}

      {step === "validating" && (
        <div className="py-8 text-center text-muted-foreground">
          検証中... ({sourceFileName})
        </div>
      )}

      {step === "validated" && validation && (
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-green-700">検証OK</p>
            <p>ファイル: {sourceFileName}</p>
            <p>変換件数: {validation.recordCount.toLocaleString()} 行</p>
            {validation.warnings.length > 0 && (
              <ul className="list-disc list-inside text-xs text-amber-700">
                {validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={resetAndRestart}>
              <RotateCcw className="mr-1 h-4 w-4" />
              ファイルを再選択
            </Button>
            <Button onClick={downloadCsv}>
              <Download className="mr-1 h-4 w-4" />
              CSVダウンロード
            </Button>
          </div>
        </div>
      )}

      {step === "downloading" && (
        <div className="py-4 text-center text-muted-foreground">ダウンロード中...</div>
      )}

      {step === "done" && (
        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-medium text-green-700">ダウンロード完了</p>
            <p>
              生成したCSVを「インポート」→「シフト管理」タブで読み込んでください。
            </p>
          </div>
          <Button variant="outline" onClick={resetAndRestart}>
            <RotateCcw className="mr-1 h-4 w-4" />
            別のファイルを変換
          </Button>
        </div>
      )}

      {step === "blocked" && (
        <div className="space-y-4">
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
              <p className="font-medium text-red-700">{errorMessage}</p>
              {sourceFileName && <p className="text-xs text-red-600 mt-1">ファイル: {sourceFileName}</p>}
            </div>
          )}

          {validation && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm space-y-3">
              <p className="font-medium text-red-700">検証NG — 以下を解消してから再実行してください</p>

              {validation.unknownCodes.length > 0 && (
                <div>
                  <p className="font-medium">
                    未登録のシフトコード ({validation.unknownCodes.length}件):
                  </p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                    {validation.unknownCodes.map((c) => (
                      <li key={c.value}>
                        <span className="font-mono">{c.value}</span>{" "}
                        (出現 {c.count} 回)
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/shift-codes"
                    className="inline-block mt-2 text-xs text-blue-600 underline"
                  >
                    → シフトコード管理画面で登録する
                  </Link>
                </div>
              )}

              {validation.unknownNames.length > 0 && (
                <div>
                  <p className="font-medium">
                    未登録の従業員名 ({validation.unknownNames.length}件):
                  </p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                    {validation.unknownNames.map((n) => (
                      <li key={n.value}>
                        {n.value} (出現 {n.count} 回)
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/employees"
                    className="inline-block mt-2 text-xs text-blue-600 underline"
                  >
                    → 従業員管理画面で登録する
                  </Link>
                </div>
              )}

              {validation.duplicateKeys.length > 0 && (
                <div>
                  <p className="font-medium">
                    Excel内の重複 ({validation.duplicateKeys.length}件):
                  </p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                    {validation.duplicateKeys.map((d, i) => (
                      <li key={i}>
                        {d.employeeName} @ {d.shiftDate} ({d.count} 回)
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs mt-1 text-muted-foreground">
                    Excelファイル内で同じ従業員・日付のシフトが複数行に存在します。Excel側で修正してください。
                  </p>
                </div>
              )}

              {validation.warnings.length > 0 && (
                <div>
                  <p className="font-medium text-amber-700">警告:</p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                    {validation.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <Button variant="outline" onClick={resetAndRestart}>
            <RotateCcw className="mr-1 h-4 w-4" />
            ファイルを再選択
          </Button>
        </div>
      )}
    </div>
  )
}
