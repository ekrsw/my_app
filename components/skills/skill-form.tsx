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
import { createSkill, updateSkill, deleteSkill } from "@/lib/actions/skill-actions"
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

type SkillFormProps = {
  skill?: {
    id: number
    skillCode: string
    skillName: string
    isActive: boolean | null
    sortOrder: number
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SkillForm({ skill, open: controlledOpen, onOpenChange }: SkillFormProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isActive, setIsActive] = useState(skill?.isActive ?? true)
  const isEdit = !!skill

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setIsActive(skill?.isActive ?? true)
    }
  }

  async function handleSubmit(formData: FormData) {
    formData.set("isActive", String(isActive))
    setLoading(true)
    const result = isEdit
      ? await updateSkill(skill.id, formData)
      : await createSkill(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "スキルを更新しました" : "スキルを作成しました")
      setOpen(false)
    }
  }

  async function handleDelete() {
    if (!skill) return
    setDeleteLoading(true)
    const result = await deleteSkill(skill.id)
    setDeleteLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("スキルを削除しました")
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
          <DialogTitle>{isEdit ? "スキル編集" : "スキル作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skillCode">スキルコード *</Label>
            <Input
              id="skillCode"
              name="skillCode"
              defaultValue={skill?.skillCode ?? ""}
              key={skill?.id ?? "new"}
              required
              maxLength={20}
              placeholder="例: EXCEL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skillName">スキル名 *</Label>
            <Input
              id="skillName"
              name="skillName"
              defaultValue={skill?.skillName ?? ""}
              key={`name-${skill?.id ?? "new"}`}
              required
              maxLength={50}
              placeholder="例: Excel操作"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sortOrder">表示順</Label>
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={skill?.sortOrder ?? 0}
              key={`sort-${skill?.id ?? "new"}`}
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
                    <AlertDialogTitle>スキルの削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      このスキルを削除してもよろしいですか？
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
