"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/lib/date-utils"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { AttendanceEditForm } from "@/components/dashboard/attendance-edit-form"
import { getShiftById } from "@/lib/actions/shift-actions"
import { ArrowRight, Plus } from "lucide-react"
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
  const [createFormOpen, setCreateFormOpen] = useState(false)

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
    setSelectEmployeeOpen(true)
  }

  function handleEmployeeConfirm() {
    if (!selectedEmployeeId) return
    setSelectEmployeeOpen(false)
    setCreateFormOpen(true)
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
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選択してください" />
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

      {/* 新規シフト作成フォーム */}
      <ShiftForm
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
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
