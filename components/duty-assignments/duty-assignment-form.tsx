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
import {
  createDutyAssignment,
  updateDutyAssignment,
  deleteDutyAssignment,
} from "@/lib/actions/duty-assignment-actions"
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
import type { DutyAssignmentWithDetails } from "@/types/duties"

type Employee = { id: string; name: string }
type DutyType = { id: number; code: string; name: string }

type DutyAssignmentFormProps = {
  employees: Employee[]
  dutyTypes: DutyType[]
  defaultDate?: string
  dutyAssignment?: DutyAssignmentWithDetails
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

function timeToInput(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

function dateToInput(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(0, 10)
}

export function DutyAssignmentForm({
  employees,
  dutyTypes,
  defaultDate,
  dutyAssignment,
  open: controlledOpen,
  onOpenChange,
}: DutyAssignmentFormProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (v: boolean) => onOpenChange?.(v) : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(dutyAssignment?.employeeId ?? "")
  const [selectedDutyTypeId, setSelectedDutyTypeId] = useState(
    dutyAssignment?.dutyTypeId?.toString() ?? ""
  )
  const isEdit = !!dutyAssignment

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelectedEmployeeId(dutyAssignment?.employeeId ?? "")
      setSelectedDutyTypeId(dutyAssignment?.dutyTypeId?.toString() ?? "")
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const data = {
      employeeId: selectedEmployeeId,
      dutyTypeId: Number(selectedDutyTypeId),
      dutyDate: formData.get("dutyDate") as string,
      startTime: formData.get("startTime") as string,
      endTime: formData.get("endTime") as string,
    }

    setLoading(true)
    const result = isEdit
      ? await updateDutyAssignment(dutyAssignment.id, data)
      : await createDutyAssignment(data)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(isEdit ? "業務割当を更新しました" : "業務割当を作成しました")
      setOpen(false)
    }
  }

  async function handleDelete() {
    if (!dutyAssignment) return
    setDeleteLoading(true)
    const result = await deleteDutyAssignment(dutyAssignment.id)
    setDeleteLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("業務割当を削除しました")
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
          <DialogTitle>{isEdit ? "業務割当編集" : "業務割当作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>従業員 *</Label>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="従業員を選択" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>業務種別 *</Label>
            <Select value={selectedDutyTypeId} onValueChange={setSelectedDutyTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="業務種別を選択" />
              </SelectTrigger>
              <SelectContent>
                {dutyTypes.map((dt) => (
                  <SelectItem key={dt.id} value={dt.id.toString()}>
                    {dt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dutyDate">日付 *</Label>
            <Input
              id="dutyDate"
              name="dutyDate"
              type="date"
              defaultValue={
                dutyAssignment ? dateToInput(dutyAssignment.dutyDate) : (defaultDate ?? "")
              }
              key={dutyAssignment?.id ?? "new"}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">開始時刻 *</Label>
              <Input
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={dutyAssignment ? timeToInput(dutyAssignment.startTime) : ""}
                key={`start-${dutyAssignment?.id ?? "new"}`}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">終了時刻 *</Label>
              <Input
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={dutyAssignment ? timeToInput(dutyAssignment.endTime) : ""}
                key={`end-${dutyAssignment?.id ?? "new"}`}
                required
              />
            </div>
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
                    <AlertDialogTitle>業務割当の削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      この業務割当を削除してもよろしいですか？
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
