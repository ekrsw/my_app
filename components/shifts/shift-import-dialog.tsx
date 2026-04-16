"use client"

import { useState } from "react"
import { Download } from "lucide-react"
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
import { Progress } from "@/components/ui/progress"
import { useShiftImport } from "@/hooks/use-shift-import"

export function ShiftImportDialog() {
  const [open, setOpen] = useState(false)
  const {
    step,
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
  } = useShiftImport()

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (value) resetState()
  }

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
          <DialogTitle>シフトCSVインポート</DialogTitle>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>エクスポートしたCSVファイルと同じ形式で読み込めます。</p>
              <p>同じ従業員・日付のシフトが存在する場合は上書き更新します。</p>
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
          <div className="py-8 space-y-3">
            <p className="text-center text-muted-foreground">インポート中...</p>
            {progress && (
              <>
                <Progress value={Math.round((Math.min(progress.current + CLIENT_CHUNK_SIZE, progress.total) / progress.total) * 100)} />
                <p className="text-center text-xs text-muted-foreground">
                  {Math.round((Math.min(progress.current + CLIENT_CHUNK_SIZE, progress.total) / progress.total) * 100)}% ({Math.min(progress.current + CLIENT_CHUNK_SIZE, progress.total).toLocaleString()} / {progress.total.toLocaleString()} 件)
                </p>
              </>
            )}
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
              <Button onClick={() => setOpen(false)}>閉じる</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
