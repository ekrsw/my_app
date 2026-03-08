"use client"

import { useState, useEffect } from "react"
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
import { createFunctionRole, updateFunctionRole, deleteFunctionRole } from "@/lib/actions/role-actions"
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

type RoleFormProps = {
  role?: {
    id: number
    roleCode: string
    roleName: string
    roleType: string
    isActive: boolean | null
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RoleForm({ role, open: controlledOpen, onOpenChange }: RoleFormProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [roleType, setRoleType] = useState(role?.roleType ?? "")
  const [isActive, setIsActive] = useState(role?.isActive ?? true)
  const isEdit = !!role

  useEffect(() => {
    if (open) {
      setRoleType(role?.roleType ?? "")
      setIsActive(role?.isActive ?? true)
    }
  }, [open, role?.id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("roleType", roleType)
    formData.set("isActive", String(isActive))
    setLoading(true)
    try {
      const result = isEdit
        ? await updateFunctionRole(role.id, formData)
        : await createFunctionRole(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEdit ? "ロールを更新しました" : "ロールを作成しました")
        setOpen(false)
      }
    } catch {
      toast.error("エラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!role) return
    setDeleteLoading(true)
    const result = await deleteFunctionRole(role.id)
    setDeleteLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("ロールを削除しました")
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
          <DialogTitle>{isEdit ? "ロール編集" : "ロール作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="roleCode">ロールコード *</Label>
            <Input
              id="roleCode"
              name="roleCode"
              defaultValue={role?.roleCode ?? ""}
              key={role?.id ?? "new"}
              required
              maxLength={20}
              placeholder="例: UKETSUKE"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleName">ロール名 *</Label>
            <Input
              id="roleName"
              name="roleName"
              defaultValue={role?.roleName ?? ""}
              key={`name-${role?.id ?? "new"}`}
              required
              maxLength={50}
              placeholder="例: 受付"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleType">ロールタイプ *</Label>
            <Input
              id="roleType"
              name="roleType"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
              required
              maxLength={20}
              placeholder="例: 業務"
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
                    <AlertDialogTitle>ロールの削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      このロールを削除してもよろしいですか？
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
