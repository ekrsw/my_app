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
import { createEmployee, updateEmployee, deleteEmployee } from "@/lib/actions/employee-actions"
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

type Group = { id: number; name: string }

type EmployeeFormProps = {
  groups: Group[]
  employee?: {
    id: number
    name: string
    nameKana: string | null
    groupId: number | null
    assignmentDate: Date | null
    terminationDate: Date | null
  }
}

function dateToInput(d: Date | null): string {
  if (!d) return ""
  return d.toISOString().split("T")[0]
}

export function EmployeeForm({ groups, employee }: EmployeeFormProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [groupId, setGroupId] = useState(employee?.groupId?.toString() ?? "")
  const isEdit = !!employee

  async function handleSubmit(formData: FormData) {
    if (groupId) formData.set("groupId", groupId)
    setLoading(true)
    const result = isEdit
      ? await updateEmployee(employee.id, formData)
      : await createEmployee(formData)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "従業員を更新しました" : "従業員を作成しました")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            編集
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
          <DialogTitle>{isEdit ? "従業員編集" : "従業員作成"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">氏名 *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={employee?.name ?? ""}
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nameKana">カナ</Label>
            <Input
              id="nameKana"
              name="nameKana"
              defaultValue={employee?.nameKana ?? ""}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>グループ</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignmentDate">配属日</Label>
              <Input
                id="assignmentDate"
                name="assignmentDate"
                type="date"
                defaultValue={dateToInput(employee?.assignmentDate ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terminationDate">退職日</Label>
              <Input
                id="terminationDate"
                name="terminationDate"
                type="date"
                defaultValue={dateToInput(employee?.terminationDate ?? null)}
              />
            </div>
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

export function EmployeeDeleteButton({ id }: { id: number }) {
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const result = await deleteEmployee(id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("従業員を削除しました")
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1 h-4 w-4" />
          削除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>従業員の削除</AlertDialogTitle>
          <AlertDialogDescription>
            この従業員を削除してもよろしいですか？シフトデータなどの関連データも削除されます。
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
