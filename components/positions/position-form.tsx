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
import { Checkbox } from "@/components/ui/checkbox"
import { createPosition, updatePosition, deletePosition } from "@/lib/actions/position-actions"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"
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

type PositionFormProps = {
  position?: {
    id: number
    positionCode: string
    positionName: string
    isActive: boolean | null
    sortOrder: number
  }
}

export function PositionForm({ position }: PositionFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(position?.isActive ?? true)
  const isEdit = !!position

  async function handleSubmit(formData: FormData) {
    formData.set("isActive", String(isActive))
    setLoading(true)
    const result = isEdit
      ? await updatePosition(position.id, formData)
      : await createPosition(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "役職を更新しました" : "役職を作成しました")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "役職編集" : "役職作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="positionCode">役職コード *</Label>
            <Input
              id="positionCode"
              name="positionCode"
              defaultValue={position?.positionCode ?? ""}
              required
              maxLength={20}
              placeholder="例: MANAGER"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="positionName">役職名 *</Label>
            <Input
              id="positionName"
              name="positionName"
              defaultValue={position?.positionName ?? ""}
              required
              maxLength={50}
              placeholder="例: 課長"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">表示順</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={position?.sortOrder ?? 0}
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="isActive">有効</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PositionDeleteButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deletePosition(id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役職を削除しました")
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>役職の削除</AlertDialogTitle>
          <AlertDialogDescription>
            この役職を削除してもよろしいですか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={loading}>
            {loading ? "削除中..." : "削除"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
