"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/date-utils"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { AttendanceEditForm } from "@/components/dashboard/attendance-edit-form"
import { getShiftById, getShiftByEmployeeAndDate } from "@/lib/actions/shift-actions"
import { ArrowRight, Plus, Search, Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ShiftChangeHistory, Employee, EmployeeGroup, Group } from "@/app/generated/prisma/client"

type TodayChange = ShiftChangeHistory & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}

type ActiveShiftCode = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
}

type Props = {
  changes: TodayChange[]
  employees: { id: string; name: string }[]
  shiftCodes: ActiveShiftCode[]
  isAuthenticated: boolean
  todayDateString: string
}

export function TodayAttendance({ changes, employees, shiftCodes, isAuthenticated, todayDateString }: Props) {
  // 新規作成: 従業員選択 → ShiftForm
  const [selectEmployeeOpen, setSelectEmployeeOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [shiftFormOpen, setShiftFormOpen] = useState(false)
  const [shiftFormTarget, setShiftFormTarget] = useState<{
    id: number
    employeeId: string | null
    shiftDate: Date
    shiftCode: string | null
    startTime: Date | null
    endTime: Date | null
    isHoliday: boolean | null
    isRemote: boolean
  } | null>(null)

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees
    const lower = employeeSearch.toLowerCase()
    return employees.filter((e) => e.name.toLowerCase().includes(lower))
  }, [employees, employeeSearch])

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  // 編集
  const [editTarget, setEditTarget] = useState<{
    shiftId: number
    historyId: number
    shift: {
      shiftCode: string | null
      startTime: Date | null
      endTime: Date | null
      isHoliday: boolean | null
      isRemote: boolean
    }
    employeeName: string
  } | null>(null)

  function handlePlusClick() {
    setSelectedEmployeeId("")
    setEmployeeSearch("")
    setSelectEmployeeOpen(true)
  }

  async function handleEmployeeConfirm() {
    if (!selectedEmployeeId) return
    setSelectEmployeeOpen(false)

    const existingShift = await getShiftByEmployeeAndDate(selectedEmployeeId, todayDateString)
    if (existingShift) {
      setShiftFormTarget(existingShift)
    } else {
      setShiftFormTarget(null)
    }
    setShiftFormOpen(true)
  }

  async function handleChangeClick(change: TodayChange) {
    if (!isAuthenticated) return
    // 削除済みシフトは編集不可
    if (change.newShiftCode === null) {
      toast.error("削除済みのシフトは編集できません")
      return
    }

    const shift = await getShiftById(change.shiftId)
    if (!shift) {
      toast.error("シフトが見つかりません")
      return
    }

    setEditTarget({
      shiftId: change.shiftId,
      historyId: change.id,
      shift: {
        shiftCode: shift.shiftCode,
        startTime: shift.startTime,
        endTime: shift.endTime,
        isHoliday: shift.isHoliday,
        isRemote: shift.isRemote,
      },
      employeeName: change.employee?.name ?? "不明",
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>本日の勤怠 ({changes.length}件)</CardTitle>
            {isAuthenticated && (
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePlusClick}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">本日の変更はありません</p>
          ) : (
            <div className="max-h-96 overflow-auto space-y-3">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className={cn(
                    "flex items-start justify-between rounded-md border p-3",
                    isAuthenticated && change.newShiftCode !== null && "cursor-pointer hover:bg-accent"
                  )}
                  onClick={() => handleChangeClick(change)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {change.employee?.name ?? "不明"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(change.shiftDate)}</span>
                      <ShiftBadge code={change.shiftCode} />
                      {change.isRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                      {change.newShiftCode !== null && (change.shiftCode !== change.newShiftCode || change.isRemote !== change.newIsRemote) && (
                        <>
                          <ArrowRight className="h-3 w-3" />
                          <ShiftBadge code={change.newShiftCode} />
                          {change.newIsRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                        </>
                      )}
                      {change.newShiftCode === null && (
                        <span className="text-destructive text-xs">削除</span>
                      )}
                    </div>
                    {change.note && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        備考: {change.note}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatDate(change.changedAt, "HH:mm")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 従業員選択ダイアログ */}
      <Dialog open={selectEmployeeOpen} onOpenChange={setSelectEmployeeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>従業員を選択</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>従業員</Label>
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
            <div className="flex justify-end gap-2">
              <Button onClick={handleEmployeeConfirm} disabled={!selectedEmployeeId}>
                次へ
              </Button>
              <Button variant="outline" onClick={() => setSelectEmployeeOpen(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* シフト作成/編集フォーム */}
      <ShiftForm
        open={shiftFormOpen}
        onOpenChange={setShiftFormOpen}
        shift={shiftFormTarget ?? undefined}
        employeeId={selectedEmployeeId}
        date={todayDateString}
        shiftCodes={shiftCodes}
      />

      {/* 勤怠修正フォーム */}
      {editTarget && (
        <AttendanceEditForm
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
          shiftId={editTarget.shiftId}
          historyId={editTarget.historyId}
          shift={editTarget.shift}
          employeeName={editTarget.employeeName}
          shiftCodes={shiftCodes}
        />
      )}
    </>
  )
}
