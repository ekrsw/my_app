"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { LogIn, RotateCcw, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  previewBulkReplaceDutyAssignments,
  executeBulkReplaceDutyAssignments,
  revertBulkReplaceDutyAssignments,
  listBulkReplaceBatches,
} from "@/lib/actions/duty-assignment-actions"
import type { BulkReplaceBatchSummary } from "@/lib/db/duty-assignments"

type DutyType = { id: number; name: string }

type Props = {
  dutyTypes: DutyType[]
}

type Preview = { matched: number; toReplace: number; skipped: number }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function DutyAssignmentBulkReplaceSection({ dutyTypes }: Props) {
  const { data: session } = useSession()
  const isAuthenticated = !!session?.user

  const [fromIds, setFromIds] = useState<number[]>([])
  const [toId, setToId] = useState<string>("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [batches, setBatches] = useState<BulkReplaceBatchSummary[]>([])
  const [revertingId, setRevertingId] = useState<number | null>(null)

  const toIdNum = toId === "" ? null : Number(toId)
  const toInFrom = toIdNum !== null && fromIds.includes(toIdNum)
  const canPreview = fromIds.length > 0 && toIdNum !== null && !toInFrom

  const loadBatches = useCallback(async () => {
    const data = await listBulkReplaceBatches()
    setBatches(data)
  }, [])

  useEffect(() => {
    if (isAuthenticated) loadBatches()
  }, [isAuthenticated, loadBatches])

  const toggleFrom = (id: number) => {
    setPreview(null)
    setFromIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  const handlePreview = async () => {
    if (!canPreview || toIdNum === null) return
    setIsPreviewing(true)
    setPreview(null)
    try {
      const result = await previewBulkReplaceDutyAssignments({
        fromDutyTypeIds: fromIds,
        toDutyTypeId: toIdNum,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setPreview(result)
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleExecute = async () => {
    if (toIdNum === null) return
    setConfirmOpen(false)
    setIsExecuting(true)
    try {
      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: fromIds,
        toDutyTypeId: toIdNum,
      })
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (result.replacedCount === 0) {
        toast.info(`置換対象がありませんでした（スキップ ${result.skippedCount} 件）`)
      } else {
        toast.success(
          `${result.replacedCount} 件を置換しました（スキップ ${result.skippedCount} 件）`
        )
      }
      setPreview(null)
      setFromIds([])
      setToId("")
      await loadBatches()
    } finally {
      setIsExecuting(false)
    }
  }

  const handleRevert = async (id: number) => {
    setRevertingId(id)
    try {
      const result = await revertBulkReplaceDutyAssignments(id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (result.failedCount > 0) {
        toast.success(
          `${result.revertedCount} 件を元に戻しました（対象外 ${result.failedCount} 件: 削除済み/変更済み）`
        )
      } else {
        toast.success(`${result.revertedCount} 件を元に戻しました`)
      }
      await loadBatches()
    } finally {
      setRevertingId(null)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
        <LogIn className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          業務割当の一括置換には管理者ログインが必要です
        </p>
      </div>
    )
  }

  const toName = dutyTypes.find((dt) => dt.id === toIdNum)?.name ?? ""
  const fromNames = fromIds
    .map((id) => dutyTypes.find((dt) => dt.id === id)?.name)
    .filter(Boolean)
    .join("、")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">業務割当の一括置換</h3>
        <p className="text-sm text-muted-foreground">
          置換元の業務種別の割当を、全期間まとめて置換先の業務種別に付け替えます（種別の統廃合）。
          同じ従業員・日付・開始時刻に置換先が既にある割当はスキップされます。
        </p>
      </div>

      {/* 置換元（複数選択） */}
      <div className="space-y-2">
        <p className="text-sm font-medium">置換元の業務種別（複数選択可）</p>
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto rounded border p-2">
          {dutyTypes.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">業務種別がありません</p>
          )}
          {dutyTypes.map((dt) => (
            <label
              key={dt.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={fromIds.includes(dt.id)}
                onCheckedChange={() => toggleFrom(dt.id)}
              />
              <span className="text-sm">{dt.name}</span>
              {toIdNum === dt.id && (
                <Badge variant="outline" className="ml-auto text-xs">
                  置換先
                </Badge>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* 置換先（単一選択） */}
      <div className="space-y-2">
        <p className="text-sm font-medium">置換先の業務種別</p>
        <Select
          value={toId}
          onValueChange={(v) => {
            setPreview(null)
            setToId(v)
          }}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="置換先を選択" />
          </SelectTrigger>
          <SelectContent>
            {dutyTypes.map((dt) => (
              <SelectItem key={dt.id} value={String(dt.id)}>
                {dt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {toInFrom && (
          <p className="text-sm text-red-600">
            置換先は置換元と異なる業務種別を選んでください
          </p>
        )}
      </div>

      {/* プレビュー & 実行 */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={handlePreview} disabled={!canPreview || isPreviewing}>
          {isPreviewing ? "確認中..." : "プレビュー"}
        </Button>
        {preview && (
          <div className="flex items-center gap-3 text-sm">
            <span>
              対象 <strong>{preview.matched}</strong> 件
            </span>
            <span className="text-muted-foreground">
              実置換 <strong>{preview.toReplace}</strong> 件 / スキップ {preview.skipped} 件
            </span>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={preview.toReplace === 0 || isExecuting}
            >
              {isExecuting ? "実行中..." : "一括置換を実行"}
            </Button>
          </div>
        )}
      </div>

      {/* 実行確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一括置換を実行しますか？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1 text-foreground">
                  <span className="font-medium">{fromNames}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span className="font-medium">{toName}</span>
                </div>
                <p>
                  {preview?.toReplace ?? 0} 件を置換します（スキップ {preview?.skipped ?? 0} 件）。
                  実行後も履歴から取り消せます。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecute}>実行する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 実行履歴 & 取り消し */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">実行履歴</h4>
        {batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">まだ実行履歴はありません。</p>
        ) : (
          <div className="divide-y rounded border">
            {batches.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-medium">{b.fromDutyTypeNames.join("、")}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{b.toDutyTypeName}</span>
                    {b.revertedAt && (
                      <Badge variant="outline" className="ml-1 text-xs">
                        取り消し済み
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(b.executedAt)} ・ {b.executedBy ?? "不明"} ・ 置換{" "}
                    {b.replacedCount} 件 / スキップ {b.skippedCount} 件
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!b.revertedAt || revertingId === b.id}
                  onClick={() => handleRevert(b.id)}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  {revertingId === b.id ? "取り消し中..." : "取り消し"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
