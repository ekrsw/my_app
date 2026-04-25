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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createFunctionRole, updateFunctionRole, deleteFunctionRole } from "@/lib/actions/role-actions"
import type { FunctionRoleKind } from "@/lib/validators"
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
    kind: FunctionRoleKind
    isActive: boolean | null
  }
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const KIND_OPTIONS: { value: FunctionRoleKind; label: string; description: string }[] = [
  { value: "SUPERVISOR", label: "監督", description: "SV 等の監督カテゴリ（集計・フィルタで監督扱い）" },
  { value: "BUSINESS", label: "業務", description: "受付・二次対応など業務カテゴリ" },
  { value: "OTHER", label: "その他", description: "意味論的に上記に該当しないロール" },
]

export function RoleForm({ role, open: controlledOpen, onOpenChange }: RoleFormProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [roleType, setRoleType] = useState(role?.roleType ?? "")
  const [kind, setKind] = useState<FunctionRoleKind>(role?.kind ?? "OTHER")
  const [isActive, setIsActive] = useState(role?.isActive ?? true)
  const isEdit = !!role

  useEffect(() => {
    if (open) {
      setRoleType(role?.roleType ?? "")
      setKind(role?.kind ?? "OTHER")
      setIsActive(role?.isActive ?? true)
    }
  }, [open, role?.id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set("roleType", roleType)
    formData.set("kind", kind)
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
            <Label htmlFor="roleType">ロールタイプ（表示ラベル）*</Label>
            <Input
              id="roleType"
              name="roleType"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
              required
              maxLength={20}
              placeholder="例: 業務 / 権限 / 職務 など（自由記述）"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">カテゴリ *（集計・フィルタの意味論）</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FunctionRoleKind)}>
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              表示ラベル（上のロールタイプ欄）は環境ごとに自由ですが、カテゴリはシステムが集計・SV 判定に使います。
            </p>
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
