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
import { createShiftCode, updateShiftCode, deleteShiftCode } from "@/lib/actions/shift-code-actions"
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

type ShiftCodeFormProps = {
  shiftCode?: {
    id: number
    code: string
    defaultStartTime: Date | null
    defaultEndTime: Date | null
    defaultIsHoliday: boolean
    isActive: boolean | null
    sortOrder: number
  }
}

function timeToInput(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

export function ShiftCodeForm({ shiftCode }: ShiftCodeFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isActive, setIsActive] = useState(shiftCode?.isActive ?? true)
  const [defaultIsHoliday, setDefaultIsHoliday] = useState(shiftCode?.defaultIsHoliday ?? false)
  const isEdit = !!shiftCode

  async function handleSubmit(formData: FormData) {
    formData.set("isActive", String(isActive))
    formData.set("defaultIsHoliday", String(defaultIsHoliday))
    setLoading(true)
    const result = isEdit
      ? await updateShiftCode(shiftCode.id, formData)
      : await createShiftCode(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "シフトコードを更新しました" : "シフトコードを作成しました")
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
          <DialogTitle>{isEdit ? "シフトコード編集" : "シフトコード作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">シフトコード *</Label>
            <Input
              id="code"
              name="code"
              defaultValue={shiftCode?.code ?? ""}
              required
              maxLength={20}
              placeholder="例: A, B, N"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultStartTime">開始時刻</Label>
              <Input
                id="defaultStartTime"
                name="defaultStartTime"
                type="time"
                defaultValue={timeToInput(shiftCode?.defaultStartTime ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultEndTime">終了時刻</Label>
              <Input
                id="defaultEndTime"
                name="defaultEndTime"
                type="time"
                defaultValue={timeToInput(shiftCode?.defaultEndTime ?? null)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="defaultIsHoliday"
                checked={defaultIsHoliday}
                onCheckedChange={(v) => setDefaultIsHoliday(v === true)}
              />
              <Label htmlFor="defaultIsHoliday">休日</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">表示順</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={shiftCode?.sortOrder ?? 0}
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

export function ShiftCodeDeleteButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteShiftCode(id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("シフトコードを削除しました")
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
          <AlertDialogTitle>シフトコードの削除</AlertDialogTitle>
          <AlertDialogDescription>
            このシフトコードを削除してもよろしいですか？
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
