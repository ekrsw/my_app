"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { formatDate, formatDateForInput } from "@/lib/date-utils"
import { updateGroupHistory, deleteGroupHistory } from "@/lib/actions/employee-actions"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import type { EmployeeGroupHistoryEntry } from "@/types/employees"

const CHANGE_TYPE_LABELS: Record<string, string> = {
  INSERT: "追加",
  UPDATE: "変更",
  DELETE: "削除",
}

const CHANGE_TYPE_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  INSERT: "default",
  UPDATE: "outline",
  DELETE: "destructive",
}

type Group = { id: number; name: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: EmployeeGroupHistoryEntry
  groups: Group[]
  isAuthenticated?: boolean
}

export function GroupHistoryDetailDialog({
  open,
  onOpenChange,
  entry,
  groups,
  isAuthenticated,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editGroupId, setEditGroupId] = useState("")
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")

  useEffect(() => {
    setEditing(false)
    setEditGroupId(entry.groupId?.toString() ?? "")
    setEditStartDate(formatDateForInput(entry.startDate))
    setEditEndDate(formatDateForInput(entry.endDate))
  }, [entry])

  function handleStartEdit() {
    setEditGroupId(entry.groupId?.toString() ?? "")
    setEditStartDate(formatDateForInput(entry.startDate))
    setEditEndDate(formatDateForInput(entry.endDate))
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
  }

  async function handleSave() {
    setSaving(true)
    const result = await updateGroupHistory(entry.id, {
      groupId: editGroupId ? Number(editGroupId) : null,
      startDate: editStartDate || null,
      endDate: editEndDate || null,
    })
    setSaving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("所属履歴を更新しました")
      setEditing(false)
      onOpenChange(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteGroupHistory(entry.id)
    setDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("所属履歴を削除しました")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            所属履歴詳細
            <Badge variant={CHANGE_TYPE_VARIANTS[entry.changeType] ?? "outline"}>
              {CHANGE_TYPE_LABELS[entry.changeType] ?? entry.changeType}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 読み取り専用フィールド */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">変更種別</span>
            <Badge variant={CHANGE_TYPE_VARIANTS[entry.changeType] ?? "outline"}>
              {CHANGE_TYPE_LABELS[entry.changeType] ?? entry.changeType}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">バージョン</span>
            <span className="text-sm font-medium">{entry.version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">変更日時</span>
            <span className="text-sm font-medium">
              {formatDate(entry.changedAt, "yyyy/MM/dd HH:mm")}
            </span>
          </div>

          <Separator />

          {/* 編集可能フィールド */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">グループ</span>
            {editing ? (
              <Select value={editGroupId} onValueChange={setEditGroupId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="グループを選択" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id.toString()}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm font-medium">{entry.group?.name ?? "未所属"}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">開始日</span>
            {editing ? (
              <Input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="w-[200px]"
              />
            ) : (
              <span className="text-sm font-medium">{formatDate(entry.startDate) || "-"}</span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">終了日</span>
            {editing ? (
              <Input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="w-[200px]"
              />
            ) : (
              <span className="text-sm font-medium">{formatDate(entry.endDate) || "-"}</span>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <DialogFooter className="flex-row justify-between sm:justify-between">
            {editing ? (
              <>
                <div />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                    キャンセル
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleStartEdit}>
                    <Pencil className="h-4 w-4 mr-1" />
                    編集
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={deleting}>
                        <Trash2 className="h-4 w-4 mr-1" />
                        {deleting ? "削除中..." : "削除"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>所属履歴の削除</AlertDialogTitle>
                        <AlertDialogDescription>
                          この所属履歴を削除してもよろしいですか？この操作は取り消せません。
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
                <div />
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
