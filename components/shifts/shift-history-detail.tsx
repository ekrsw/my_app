"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ShiftBadge } from "./shift-badge"
import { formatDate, formatTime } from "@/lib/date-utils"
import {
  updateShiftHistory,
  deleteShiftHistory,
  restoreShiftVersion,
} from "@/lib/actions/shift-actions"
import { toast } from "sonner"
import { ArrowRight, RotateCcw, Trash2, Pencil, Check, X, ArrowLeft } from "lucide-react"
import type { ShiftHistoryEntry } from "@/types/shifts"
import type { ShiftChangeHistory } from "@/app/generated/prisma/client"

type ShiftHistoryDetailProps = {
  entry: ShiftHistoryEntry
  versions: ShiftChangeHistory[]
}

export function ShiftHistoryDetail({ entry, versions }: ShiftHistoryDetailProps) {
  const router = useRouter()
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(entry.note ?? "")
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isDeleted = entry.newShiftCode === null

  async function handleSaveNote() {
    setSaving(true)
    const result = await updateShiftHistory(entry.id, { note: noteValue })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("備考を更新しました")
      setEditingNote(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    const result = await restoreShiftVersion(entry.shiftId, entry.version)
    setRestoring(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`バージョン${entry.version}に復元しました`)
      router.push("/shifts?tab=history")
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteShiftHistory(entry.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("変更履歴を削除しました")
      router.push("/shifts?tab=history")
    }
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => router.push("/shifts?tab=history")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {!isDeleted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={restoring}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  {restoring ? "復元中..." : "このバージョンに復元"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>バージョンの復元</AlertDialogTitle>
                  <AlertDialogDescription>
                    バージョン{entry.version}の状態にシフトを復元します。よろしいですか？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestore} disabled={restoring}>
                    復元
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "削除中..." : "この履歴を削除"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>変更履歴の削除</AlertDialogTitle>
                <AlertDialogDescription>
                  この変更履歴を削除してもよろしいですか？この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  削除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Detail card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            変更内容
            <Badge variant="outline">v{entry.version}</Badge>
            {isDeleted && <Badge variant="destructive">削除</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">従業員</p>
              <p className="font-medium">{entry.employee?.name ?? "不明"}</p>
              {entry.employee?.groups && entry.employee.groups.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {entry.employee.groups.map((g) => g.group.name).join(", ")}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">シフト日</p>
              <p className="font-medium">{formatDate(entry.shiftDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">変更日時</p>
              <p className="font-medium">{formatDate(entry.changedAt, "yyyy/MM/dd HH:mm")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">シフトID</p>
              <p className="font-medium">{entry.shiftId}</p>
            </div>
          </div>

          {/* Before / After comparison */}
          <div className="border rounded-md p-4 space-y-3">
            <p className="text-sm font-medium">変更前後の比較</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {/* Shift code */}
              <div>
                <span className="text-muted-foreground">シフトコード: </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <ShiftBadge code={entry.shiftCode} />
                  {entry.isRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  {isDeleted ? (
                    <span className="text-xs text-muted-foreground">削除</span>
                  ) : (
                    <>
                      <ShiftBadge code={entry.newShiftCode} />
                      {entry.newIsRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                    </>
                  )}
                </div>
              </div>
              {/* Start time */}
              <div>
                <span className="text-muted-foreground">開始時間: </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span>{entry.startTime ? formatTime(entry.startTime) : "-"}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{!isDeleted && entry.newStartTime ? formatTime(entry.newStartTime) : "-"}</span>
                </div>
              </div>
              {/* End time */}
              <div>
                <span className="text-muted-foreground">終了時間: </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <span>{entry.endTime ? formatTime(entry.endTime) : "-"}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span>{!isDeleted && entry.newEndTime ? formatTime(entry.newEndTime) : "-"}</span>
                </div>
              </div>
              {/* Holiday / Remote */}
              <div>
                <span className="text-muted-foreground">フラグ: </span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1">
                    {entry.isHoliday && <Badge variant="secondary">休日</Badge>}
                    {entry.isRemote && <Badge variant="secondary">テレワーク</Badge>}
                    {!entry.isHoliday && !entry.isRemote && <span>-</span>}
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  {isDeleted ? (
                    <span>-</span>
                  ) : (
                    <div className="flex gap-1">
                      {entry.newIsHoliday && <Badge variant="secondary">休日</Badge>}
                      {entry.newIsRemote && <Badge variant="secondary">テレワーク</Badge>}
                      {!entry.newIsHoliday && !entry.newIsRemote && <span>-</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm text-muted-foreground">備考</p>
              {!editingNote && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditingNote(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {editingNote ? (
              <div className="flex items-center gap-2">
                <Input
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="備考を入力..."
                  maxLength={255}
                  className="max-w-md"
                />
                <Button size="icon" className="h-8 w-8" onClick={handleSaveNote} disabled={saving}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditingNote(false)
                    setNoteValue(entry.note ?? "")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm">{entry.note || <span className="text-muted-foreground">-</span>}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Version history */}
      <Card>
        <CardHeader>
          <CardTitle>バージョン一覧（シフトID: {entry.shiftId}）</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">バージョン履歴がありません</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`rounded-md border p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors ${v.id === entry.id ? "border-primary bg-muted/30" : ""}`}
                  onClick={() => {
                    if (v.id !== entry.id) router.push(`/shifts/history/${v.id}`)
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={v.id === entry.id ? "default" : "outline"}>v{v.version}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(v.changedAt, "yyyy/MM/dd HH:mm")}
                      </span>
                      {v.id === entry.id && (
                        <Badge variant="secondary" className="text-xs">現在表示中</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <ShiftBadge code={v.shiftCode} />
                    {v.isRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {v.newShiftCode === null ? (
                      <span className="text-xs text-muted-foreground">削除</span>
                    ) : (
                      <>
                        <ShiftBadge code={v.newShiftCode} />
                        {v.newIsRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                      </>
                    )}
                  </div>
                  {v.note && (
                    <p className="text-xs text-muted-foreground">備考: {v.note}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
