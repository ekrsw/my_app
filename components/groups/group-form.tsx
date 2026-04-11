"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGroup, updateGroup, deleteGroup } from "@/lib/actions/group-actions"
import { toast } from "sonner"
import { Plus } from "lucide-react"
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

type GroupFormProps = {
  group?: { id: number; name: string; abbreviatedName: string | null }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function GroupForm({ group, open: controlledOpen, onOpenChange }: GroupFormProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const isEdit = !!group

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = isEdit
      ? await updateGroup(group.id, formData)
      : await createGroup(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "グループを更新しました" : "グループを作成しました")
      setOpen(false)
    }
  }

  async function handleDelete() {
    if (!group) return
    setDeleteLoading(true)
    const result = await deleteGroup(group.id)
    setDeleteLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("グループを削除しました")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "グループ編集" : "グループ作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">グループ名</Label>
            <Input
              id="name"
              name="name"
              defaultValue={group?.name ?? ""}
              key={group?.id ?? "new"}
              required
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="abbreviatedName">省略名</Label>
            <Input
              id="abbreviatedName"
              name="abbreviatedName"
              defaultValue={group?.abbreviatedName ?? ""}
              key={`abbr-${group?.id ?? "new"}`}
              maxLength={10}
              placeholder="10文字以内"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            {isEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteLoading}>
                    {deleteLoading ? "削除中..." : "削除"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>グループの削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      このグループを削除してもよろしいですか？この操作は取り消せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleteLoading}>
                      {deleteLoading ? "削除中..." : "削除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
