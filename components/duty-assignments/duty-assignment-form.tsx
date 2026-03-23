"use client"

import { useState, useMemo } from "react"
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  createDutyAssignment,
  updateDutyAssignment,
  deleteDutyAssignment,
} from "@/lib/actions/duty-assignment-actions"
import { toast } from "sonner"
import { Plus, Search, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
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
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const isEdit = !!dutyAssignment

  const [prevOpen, setPrevOpen] = useState(false)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setSelectedEmployeeId(dutyAssignment?.employeeId ?? "")
      setSelectedDutyTypeId(dutyAssignment?.dutyTypeId?.toString() ?? "")
    }
  }

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees
    const lower = employeeSearch.toLowerCase()
    return employees.filter((e) => e.name.toLowerCase().includes(lower))
  }, [employees, employeeSearch])

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

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
            <Popover
              open={employeePopoverOpen}
              onOpenChange={(v) => {
                setEmployeePopoverOpen(v)
                if (!v) setEmployeeSearch("")
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={employeePopoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedEmployee ? selectedEmployee.name : "従業員を選択"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="従業員名で検索..."
                    className="h-8 pl-7"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <div className="flex flex-col gap-0.5">
                    {filteredEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm",
                          emp.id === selectedEmployeeId && "bg-accent"
                        )}
                        onClick={() => {
                          setSelectedEmployeeId(emp.id)
                          setEmployeePopoverOpen(false)
                          setEmployeeSearch("")
                        }}
                      >
                        <Check
                          className={cn(
                            "h-3.5 w-3.5 shrink-0",
                            emp.id === selectedEmployeeId ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {emp.name}
                      </div>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <p className="text-sm text-muted-foreground px-2 py-1.5">
                        該当なし
                      </p>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
