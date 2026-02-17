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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createFunctionRole, updateFunctionRole, deleteFunctionRole } from "@/lib/actions/role-actions"
import { ROLE_TYPE_LABELS } from "@/lib/constants"
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

type RoleFormProps = {
  role?: {
    id: number
    roleCode: string
    roleName: string
    roleType: string
    isActive: boolean | null
  }
}

export function RoleForm({ role }: RoleFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roleType, setRoleType] = useState(role?.roleType ?? "FUNCTION")
  const [isActive, setIsActive] = useState(role?.isActive ?? true)
  const isEdit = !!role

  async function handleSubmit(formData: FormData) {
    formData.set("roleType", roleType)
    formData.set("isActive", String(isActive))
    setLoading(true)
    const result = isEdit
      ? await updateFunctionRole(role.id, formData)
      : await createFunctionRole(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "役割を更新しました" : "役割を作成しました")
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
          <DialogTitle>{isEdit ? "役割編集" : "役割作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="roleCode">役割コード *</Label>
            <Input
              id="roleCode"
              name="roleCode"
              defaultValue={role?.roleCode ?? ""}
              required
              maxLength={20}
              placeholder="例: UKETSUKE"
            />
          </div>
          <div>
            <Label htmlFor="roleName">役割名 *</Label>
            <Input
              id="roleName"
              name="roleName"
              defaultValue={role?.roleName ?? ""}
              required
              maxLength={50}
              placeholder="例: 受付"
            />
          </div>
          <div>
            <Label>分類 *</Label>
            <Select value={roleType} onValueChange={setRoleType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export function RoleDeleteButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteFunctionRole(id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("役割を削除しました")
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
          <AlertDialogTitle>役割の削除</AlertDialogTitle>
          <AlertDialogDescription>
            この役割を削除してもよろしいですか？
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
