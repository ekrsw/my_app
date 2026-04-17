"use client"

import { useSession } from "next-auth/react"
import { LogIn, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CsvFileInput } from "@/components/csv-import/csv-file-input"
import { CsvPreviewTable } from "@/components/csv-import/csv-preview-table"
import { useDutyTypeImport } from "@/hooks/use-duty-type-import"

export function DutyTypeImportSection() {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user

  const {
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
  } = useDutyTypeImport()

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          CSVインポートには管理者ログインが必要です
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">業務種別マスタCSVインポート</h3>

      {step === "select" && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>CSV形式: 業務名, 色, 有効, 表示順, キャパシティ減少, デフォルト開始時刻, デフォルト終了時刻, デフォルトタイトル, デフォルトメモ</p>
            <p>必須: 業務名。同名の業務種別が存在する場合は更新されます</p>
            <p>有効/キャパシティ減少: true/1 で有効、false/0 で無効。時刻形式: HH:mm</p>
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
                {result.errors.slice(0, 50).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e.rowIndex > 0 ? `${e.rowIndex}行目: ` : ""}{e.error}
                  </p>
                ))}
                {result.errors.length > 50 && (
                  <p className="text-xs text-muted-foreground">
                    他 {result.errors.length - 50} 件のエラー
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={resetState}>
              <RotateCcw className="mr-1 h-4 w-4" />
              リセット
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
