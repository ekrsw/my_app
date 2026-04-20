"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date-utils"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ShiftForm } from "@/components/shifts/shift-form"
import { AttendanceEditForm } from "@/components/dashboard/attendance-edit-form"
import { getShiftById } from "@/lib/actions/shift-actions"
import { ArrowRight, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { SHIFT_CODE_MAP, getColorClasses, type ShiftCodeInfo } from "@/lib/constants"
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
  defaultLunchBreakStart: Date | null
  defaultLunchBreakEnd: Date | null
}

type Props = {
  changes: TodayChange[]
  employees: { id: string; name: string }[]
  shiftCodes: ActiveShiftCode[]
  isAuthenticated: boolean
  todayDateString: string
}

export function TodayAttendance({ changes, employees, shiftCodes, isAuthenticated, todayDateString }: Props) {
  const [shiftFormOpen, setShiftFormOpen] = useState(false)

  // DB のシフトコードから shiftCodeMap を構築（バッジカラー表示用）
  const shiftCodeMap = useMemo(() => {
    const map: Record<string, ShiftCodeInfo> = {}
    for (const sc of shiftCodes) {
      const dbColor = getColorClasses(sc.color)
      const hardcoded = SHIFT_CODE_MAP[sc.code]
      map[sc.code] = {
        label: hardcoded?.label ?? sc.code,
        color: dbColor?.text ?? hardcoded?.color ?? "text-gray-800",
        bgColor: dbColor?.bg ?? hardcoded?.bgColor ?? "bg-gray-100",
      }
    }
    return map
  }, [shiftCodes])

  // 同一シフトの最新変更のみ編集可能にする（changedAtが最新のもの）
  const latestChangeIdPerShift = useMemo(() => {
    const map = new Map<number, { id: number; changedAt: Date }>()
    for (const change of changes) {
      const existing = map.get(change.shiftId)
      if (!existing || new Date(change.changedAt) > new Date(existing.changedAt)) {
        map.set(change.shiftId, { id: change.id, changedAt: change.changedAt })
      }
    }
    return new Set(Array.from(map.values()).map((v) => v.id))
  }, [changes])

  function isEditable(change: TodayChange): boolean {
    if (change.newShiftCode === null) return false
    return latestChangeIdPerShift.has(change.id)
  }

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
      lunchBreakStart: Date | null
      lunchBreakEnd: Date | null
    }
    employeeName: string
    note: string | null
  } | null>(null)

  async function handleChangeClick(change: TodayChange) {
    if (!isAuthenticated) return

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
        lunchBreakStart: shift.lunchBreakStart,
        lunchBreakEnd: shift.lunchBreakEnd,
      },
      employeeName: change.employee?.name ?? "不明",
      note: change.note,
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>本日の勤怠 ({changes.length}件)</CardTitle>
            {isAuthenticated && (
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setShiftFormOpen(true)}>
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
                    isAuthenticated && isEditable(change) && "cursor-pointer hover:bg-accent"
                  )}
                  onClick={() => isEditable(change) && handleChangeClick(change)}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {change.employee?.name ?? "不明"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatDate(change.shiftDate)}</span>
                      <ShiftBadge code={change.shiftCode} shiftCodeMap={shiftCodeMap} />
                      {change.isRemote && <span className="text-xs text-sky-600 font-medium">TW</span>}
                      {change.newShiftCode !== null && (change.shiftCode !== change.newShiftCode || change.isRemote !== change.newIsRemote) && (
                        <>
                          <ArrowRight className="h-3 w-3" />
                          <ShiftBadge code={change.newShiftCode} shiftCodeMap={shiftCodeMap} />
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

      {/* シフト作成フォーム（従業員選択込み） */}
      <ShiftForm
        open={shiftFormOpen}
        onOpenChange={setShiftFormOpen}
        date={todayDateString}
        shiftCodes={shiftCodes}
        employees={employees}
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
          initialNote={editTarget.note}
        />
      )}
    </>
  )
}
