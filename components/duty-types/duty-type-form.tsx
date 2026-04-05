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
import { createDutyType, updateDutyType, deleteDutyType } from "@/lib/actions/duty-type-actions"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"
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

type DutyTypeFormProps = {
  dutyType?: {
    id: number
    code: string
    name: string
    color: string | null
    isActive: boolean | null
    sortOrder: number
    defaultReducesCapacity: boolean
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DutyTypeForm({ dutyType, open: controlledOpen, onOpenChange }: DutyTypeFormProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isActive, setIsActive] = useState(dutyType?.isActive ?? true)
  const [defaultReducesCapacity, setReducesCapacity] = useState(dutyType?.defaultReducesCapacity ?? true)
  const [selectedColor, setSelectedColor] = useState<string | null>(dutyType?.color ?? null)
  const isEdit = !!dutyType

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setIsActive(dutyType?.isActive ?? true)
      setReducesCapacity(dutyType?.defaultReducesCapacity ?? true)
      setSelectedColor(dutyType?.color ?? null)
    }
  }

  async function handleSubmit(formData: FormData) {
    formData.set("isActive", String(isActive))
    formData.set("defaultReducesCapacity", String(defaultReducesCapacity))
    if (selectedColor) {
      formData.set("color", selectedColor)
    } else {
      formData.delete("color")
    }
    setLoading(true)
    const result = isEdit
      ? await updateDutyType(dutyType.id, formData)
      : await createDutyType(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "業務種別を更新しました" : "業務種別を作成しました")
      setOpen(false)
    }
  }

  async function handleDelete() {
    if (!dutyType) return
    setDeleteLoading(true)
    const result = await deleteDutyType(dutyType.id)
    setDeleteLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("業務種別を削除しました")
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "業務種別編集" : "業務種別作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">業務コード *</Label>
            <Input
              id="code"
              name="code"
              defaultValue={dutyType?.code ?? ""}
              key={dutyType?.id ?? "new"}
              required
              maxLength={20}
              placeholder="例: DIRECT_CALL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">業務名 *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={dutyType?.name ?? ""}
              key={`name-${dutyType?.id ?? "new"}`}
              required
              maxLength={50}
              placeholder="例: 直着業務"
            />
          </div>
          <div className="space-y-2">
            <Label>表示色</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COLOR_PALETTE).map(([key, palette]) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    palette.swatch,
                    selectedColor === key
                      ? "ring-2 ring-offset-2 ring-primary"
                      : "hover:ring-2 hover:ring-offset-1 hover:ring-muted-foreground/50"
                  )}
                  title={palette.label}
                  onClick={() => setSelectedColor(key)}
                />
              ))}
              {selectedColor && (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:bg-muted"
                  title="色をクリア"
                  onClick={() => setSelectedColor(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {selectedColor && (
              <p className="text-xs text-muted-foreground">
                選択中: {COLOR_PALETTE[selectedColor]?.label}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">表示順</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={dutyType?.sortOrder ?? 0}
              key={`sort-${dutyType?.id ?? "new"}`}
              min={0}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="defaultReducesCapacity"
              checked={defaultReducesCapacity}
              onCheckedChange={(v) => setReducesCapacity(v === true)}
            />
            <Label htmlFor="defaultReducesCapacity" className="flex flex-col">
              <span>対応可能人員から控除する（初期値）</span>
              <span className="text-xs font-normal text-muted-foreground">
                業務割当作成時のデフォルト値として使用されます
              </span>
            </Label>
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
                    <AlertDialogTitle>業務種別の削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      この業務種別を削除してもよろしいですか？
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
