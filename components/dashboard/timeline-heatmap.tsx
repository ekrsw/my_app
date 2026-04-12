"use client"

import { ReactNode, useMemo, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { getTimeHHMM, getCurrentJSTTimeHHMM, isLunchBreak } from "@/lib/capacity-utils"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { CheckboxListFilter } from "@/components/common/filters/checkbox-list-filter"
import { DutyBarsOverlay, computeLaneCount, computeRowHeight, type DutyBarInput } from "@/components/common/duty-bars-overlay"
import { DutyAssignmentDetailDialog } from "@/components/duty-assignments/duty-assignment-detail-dialog"
import type { TodayShift } from "@/components/dashboard/today-overview-client"
import type { DutyAssignmentWithDetails } from "@/types/duties"

/** 指定範囲の30分刻みスロットを生成 */
export function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = []
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
    }
  }
  return slots
}

/** 8:00〜21:30 の30分刻みスロット（28個） */
const TIME_SLOTS_DAY = generateTimeSlots(8, 22)
/** 0:00〜23:30 の30分刻みスロット（48個） */
const TIME_SLOTS_FULL = generateTimeSlots(0, 24)

/**
 * ヒートマップ用の在席判定（今日のシフト）。
 * isWorkerPresent (capacity-utils) とは異なるセマンティクス:
 * - 通常シフト: start <= slot < end（終業時刻のスロットは不在扱い）
 * - 深夜跨ぎシフト(end < start): slot >= start のみ（翌日側は今日の出勤者に含めない）
 */
export function isPresent(
  startTime: Date | string | null,
  endTime: Date | string | null,
  slot: string,
  lunchBreakStart?: Date | string | null,
  lunchBreakEnd?: Date | string | null
): boolean {
  if (!startTime) return false
  const start = getTimeHHMM(startTime)
  if (isLunchBreak(lunchBreakStart, lunchBreakEnd, slot)) return false
  if (!endTime) return start <= slot
  const end = getTimeHHMM(endTime)
  if (start <= end) {
    // 通常シフト (例: 9:00-17:00)
    return start <= slot && slot < end
  }
  // 深夜跨ぎシフト (例: 22:00-08:00)
  // ヒートマップ範囲内ではstartTime以降のスロットのみ在席
  return slot >= start
}

/**
 * 前日夜勤の在席判定（翌日=今日の0:00〜endTime部分のみ）。
 * 前日の深夜跨ぎシフト(例: 22:00-08:00)の今日側(0:00-08:00)を表示する。
 */
export function isPresentOvernight(
  endTime: Date | string | null,
  slot: string
): boolean {
  if (!endTime) return false
  const end = getTimeHHMM(endTime)
  return slot < end
}

/** 時間ラベル（08, 09, ... 21）*/
const HOUR_LABELS_DAY = Array.from({ length: 14 }, (_, i) => i + 8)
/** 時間ラベル（00, 01, ... 23）*/
const HOUR_LABELS_FULL = Array.from({ length: 24 }, (_, i) => i)

type FilterOption = { value: string; label: ReactNode; searchText?: string }

type MergedRow = {
  employeeId: string
  employeeName: string
  employee: TodayShift["employee"]
  presence: boolean[]
  lunchBreak: boolean[]
}

type Props = {
  shifts: TodayShift[]
  overnightShifts?: TodayShift[]
  showFullDay?: boolean
  nameSearch?: string
  onRowCountChange?: (count: number) => void
  onShiftCellClick?: (shift: TodayShift) => void
  distinctRoleTypes: readonly [string, string]
  // 業務割当オーバーレイ
  duties?: DutyAssignmentWithDetails[]
  // グループフィルター
  groupOptions: FilterOption[]
  selectedGroupValues: string[]
  unassigned: boolean
  groupPopoverOpen: boolean
  onGroupPopoverOpenChange: (open: boolean) => void
  onGroupConfirm: (ids: string[], specialChecked?: boolean) => void
  onGroupClear: () => void
  hasUnassigned: boolean
  // 業務ロールフィルター
  businessRoleOptions: FilterOption[]
  selectedBusinessRoleNames: string[]
  businessPopoverOpen: boolean
  onBusinessPopoverOpenChange: (open: boolean) => void
  onBusinessRoleConfirm: (names: string[]) => void
  onBusinessRoleClear: () => void
  // 監督ロールフィルター
  supervisorRoleOptions: FilterOption[]
  selectedSupervisorRoleNames: string[]
  supervisorPopoverOpen: boolean
  onSupervisorPopoverOpenChange: (open: boolean) => void
  onSupervisorRoleConfirm: (names: string[]) => void
  onSupervisorRoleClear: () => void
  // 業務割当詳細ダイアログ用
  isAuthenticated?: boolean
  employees?: { id: string; name: string }[]
  dutyTypes?: { id: number; name: string; defaultReducesCapacity: boolean; defaultStartTime: string | null; defaultEndTime: string | null; defaultNote: string | null; defaultTitle: string | null }[]
}

export function TimelineHeatmap({
  shifts,
  overnightShifts = [],
  showFullDay = false,
  nameSearch = "",
  onRowCountChange,
  onShiftCellClick,
  distinctRoleTypes,
  duties,
  groupOptions,
  selectedGroupValues,
  unassigned,
  groupPopoverOpen,
  onGroupPopoverOpenChange,
  onGroupConfirm,
  onGroupClear,
  hasUnassigned,
  businessRoleOptions,
  selectedBusinessRoleNames,
  businessPopoverOpen,
  onBusinessPopoverOpenChange,
  onBusinessRoleConfirm,
  onBusinessRoleClear,
  supervisorRoleOptions,
  selectedSupervisorRoleNames,
  supervisorPopoverOpen,
  onSupervisorPopoverOpenChange,
  onSupervisorRoleConfirm,
  onSupervisorRoleClear,
  isAuthenticated = false,
  employees = [],
  dutyTypes = [],
}: Props) {
  const [currentTime, setCurrentTime] = useState(getCurrentJSTTimeHHMM)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>(600)
  const [selectedDutyId, setSelectedDutyId] = useState<number | null>(null)

  const selectedDuty = useMemo(
    () => (selectedDutyId !== null ? (duties?.find((d) => d.id === selectedDutyId) ?? null) : null),
    [selectedDutyId, duties]
  )

  const timeSlots = showFullDay ? TIME_SLOTS_FULL : TIME_SLOTS_DAY
  const hourLabels = showFullDay ? HOUR_LABELS_FULL : HOUR_LABELS_DAY

  // 業務バーの時間軸範囲（ヒートマップの表示範囲と対応）
  const axisStartMinutes = showFullDay ? 0 : 8 * 60
  const axisEndMinutes = showFullDay ? 24 * 60 : 22 * 60

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentJSTTimeHHMM())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateHeight = () => {
      const rect = container.getBoundingClientRect()
      const available = window.innerHeight - rect.top - 48
      setMaxHeight(Math.max(300, available))
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)
    const observer = new ResizeObserver(updateHeight)
    observer.observe(document.documentElement)

    return () => {
      window.removeEventListener("resize", updateHeight)
      observer.disconnect()
    }
  })

  // 従業員単位でマージしたグリッド
  const mergedGrid = useMemo<MergedRow[]>(() => {
    const employeeMap = new Map<string, {
      employee: TodayShift["employee"]
      todayPresence: boolean[]
      overnightPresence: boolean[]
      lunchBreak: boolean[]
    }>()

    // 今日のシフト
    for (const shift of shifts) {
      const empId = shift.employee?.id
      if (!empId) continue
      const presence = timeSlots.map((slot) =>
        isPresent(shift.startTime, shift.endTime, slot, shift.lunchBreakStart, shift.lunchBreakEnd)
      )
      const lunchBreak = timeSlots.map((slot) =>
        isLunchBreak(shift.lunchBreakStart, shift.lunchBreakEnd, slot)
      )
      employeeMap.set(empId, {
        employee: shift.employee,
        todayPresence: presence,
        overnightPresence: timeSlots.map(() => false),
        lunchBreak,
      })
    }

    // 前日夜勤（showFullDay=trueの時のみマージ）
    if (showFullDay) {
      for (const shift of overnightShifts) {
        const empId = shift.employee?.id
        if (!empId) continue
        const overnightPresence = timeSlots.map((slot) =>
          isPresentOvernight(shift.endTime, slot)
        )
        const existing = employeeMap.get(empId)
        if (existing) {
          existing.overnightPresence = overnightPresence
        } else {
          employeeMap.set(empId, {
            employee: shift.employee,
            todayPresence: timeSlots.map(() => false),
            overnightPresence,
            lunchBreak: timeSlots.map(() => false),
          })
        }
      }
    }

    // OR結合して最終グリッドを生成
    const rows: MergedRow[] = []
    for (const [empId, data] of employeeMap) {
      rows.push({
        employeeId: empId,
        employeeName: data.employee?.name ?? "",
        employee: data.employee,
        presence: data.todayPresence.map((today, i) => today || data.overnightPresence[i]),
        lunchBreak: data.lunchBreak,
      })
    }

    return rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ja"))
  }, [shifts, overnightShifts, showFullDay, timeSlots])

  // 業務割当を従業員IDでマップ化（ヒートマップ行に業務バーを重ねるため）
  const dutyBarsMap = useMemo(() => {
    if (!duties || duties.length === 0) return new Map<string, DutyBarInput[]>()
    const map = new Map<string, DutyBarInput[]>()
    for (const duty of duties) {
      if (!duty.startTime || !duty.endTime) continue
      const startHHMM = getTimeHHMM(duty.startTime)
      const endHHMM = getTimeHHMM(duty.endTime)
      const startMin =
        parseInt(startHHMM.split(":")[0], 10) * 60 +
        parseInt(startHHMM.split(":")[1], 10)
      let endMin =
        parseInt(endHHMM.split(":")[0], 10) * 60 +
        parseInt(endHHMM.split(":")[1], 10)
      if (endMin <= startMin) endMin = 24 * 60 // 日跨ぎ

      const bar: DutyBarInput = {
        id: duty.id,
        dutyTypeName: duty.dutyType.name,
        title: duty.title,
        color: duty.dutyType.color,
        startMinutes: startMin,
        endMinutes: endMin,
        employeeName: duty.employee.name,
      }
      const existing = map.get(duty.employeeId) ?? []
      existing.push(bar)
      map.set(duty.employeeId, existing)
    }
    return map
  }, [duties])

  // 今日のシフトをemployeeIdで逆引き（セルクリック時に使用）
  const shiftByEmployeeId = useMemo(() => {
    const map = new Map<string, TodayShift>()
    for (const shift of shifts) {
      const empId = shift.employee?.id
      if (empId) map.set(empId, shift)
    }
    return map
  }, [shifts])

  // 名前検索フィルタ
  const filteredGrid = useMemo(() => {
    if (!nameSearch.trim()) return mergedGrid
    const query = nameSearch.trim().toLowerCase()
    return mergedGrid.filter((row) =>
      row.employeeName.toLowerCase().includes(query)
    )
  }, [mergedGrid, nameSearch])

  // 親に行数を通知
  useEffect(() => {
    onRowCountChange?.(filteredGrid.length)
  }, [filteredGrid.length, onRowCountChange])

  const slotCounts = useMemo(
    () =>
      timeSlots.map((_, i) =>
        filteredGrid.reduce((count, row) => count + (row.presence[i] ? 1 : 0), 0)
      ),
    [filteredGrid, timeSlots]
  )

  const currentSlotIndex = useMemo(() => {
    for (let i = timeSlots.length - 1; i >= 0; i--) {
      if (currentTime >= timeSlots[i]) return i
    }
    return -1
  }, [currentTime, timeSlots])

  return (
    <div className="flex flex-col gap-2">
      {/* フィルターツールバー */}
      <div className="flex items-center gap-3 text-sm flex-wrap">
        <ColumnFilterPopover
          label="グループ"
          isActive={selectedGroupValues.length > 0 || unassigned}
          activeCount={selectedGroupValues.length + (unassigned ? 1 : 0)}
          open={groupPopoverOpen}
          onOpenChange={onGroupPopoverOpenChange}
        >
          <CheckboxListFilter
            options={groupOptions}
            selectedValues={selectedGroupValues}
            onConfirm={onGroupConfirm}
            onClear={onGroupClear}
            popoverOpen={groupPopoverOpen}
            specialOption={hasUnassigned || unassigned ? {
              value: "unassigned",
              label: "未所属",
              checked: unassigned,
            } : undefined}
            searchPlaceholder="グループ名で検索..."
          />
        </ColumnFilterPopover>
        <ColumnFilterPopover
          label={distinctRoleTypes[1]}
          isActive={selectedBusinessRoleNames.length > 0}
          activeCount={selectedBusinessRoleNames.length}
          open={businessPopoverOpen}
          onOpenChange={onBusinessPopoverOpenChange}
        >
          <CheckboxListFilter
            options={businessRoleOptions}
            selectedValues={selectedBusinessRoleNames}
            onConfirm={onBusinessRoleConfirm}
            onClear={onBusinessRoleClear}
            popoverOpen={businessPopoverOpen}
            searchPlaceholder={`${distinctRoleTypes[1]}で検索...`}
          />
        </ColumnFilterPopover>
        <ColumnFilterPopover
          label={distinctRoleTypes[0]}
          isActive={selectedSupervisorRoleNames.length > 0}
          activeCount={selectedSupervisorRoleNames.length}
          open={supervisorPopoverOpen}
          onOpenChange={onSupervisorPopoverOpenChange}
        >
          <CheckboxListFilter
            options={supervisorRoleOptions}
            selectedValues={selectedSupervisorRoleNames}
            onConfirm={onSupervisorRoleConfirm}
            onClear={onSupervisorRoleClear}
            popoverOpen={supervisorPopoverOpen}
            searchPlaceholder={`${distinctRoleTypes[0]}で検索...`}
          />
        </ColumnFilterPopover>
      </div>

      {/* ヒートマップテーブル */}
      <div
        ref={scrollContainerRef}
        className="rounded-md border overflow-auto"
        style={{ maxHeight }}
      >
      <table className="border-collapse text-xs">
        {/* ヘッダー: 2行構成 */}
        <thead className="sticky top-0 z-20">
          {/* 1行目: 時間ラベル（colSpan=2で :00 と :30 をまとめる） */}
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-30 min-w-[120px] bg-background px-3 py-1.5 text-left font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
            >
              従業員名
            </th>
            {hourLabels.map((hour) => {
              const slotIdx = (hour - hourLabels[0]) * 2
              const isCurrent =
                currentSlotIndex === slotIdx || currentSlotIndex === slotIdx + 1
              return (
                <th
                  key={hour}
                  colSpan={2}
                  className={cn(
                    "bg-background px-0 py-1 text-center font-medium border-l border-border",
                    isCurrent && "border-b-2 border-b-primary"
                  )}
                >
                  {hour}:00
                </th>
              )
            })}
          </tr>
          {/* 2行目: :00 / :30 サブラベル */}
          <tr>
            {timeSlots.map((slot, i) => {
              const isCurrent = i === currentSlotIndex
              return (
                <th
                  key={slot}
                  className={cn(
                    "bg-background w-9 min-w-9 px-0 py-0.5 text-center font-normal text-muted-foreground",
                    i % 2 === 0 && "border-l border-border",
                    isCurrent && "border-b-2 border-b-primary"
                  )}
                >
                  {slot.substring(3)}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {filteredGrid.map((row) => {
            const emp = row.employee
            const empBars = dutyBarsMap.get(row.employeeId) ?? []
            const hasDuties = empBars.length > 0
            const laneCount = hasDuties ? computeLaneCount(empBars) : 0
            const rowHeight = hasDuties ? computeRowHeight(laneCount, 20, 2) : 28
            const todayShift = shiftByEmployeeId.get(row.employeeId)
            const isClickable = !!todayShift && !!onShiftCellClick
            return (
              <tr key={row.employeeId} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-background px-3 py-1 font-medium whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                  {emp ? (
                    <Link
                      href={`/employees/${emp.id}`}
                      className="hover:underline hover:text-primary"
                    >
                      {emp.name}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td colSpan={timeSlots.length} className="p-0" style={{ height: rowHeight }}>
                  <div className="relative w-full" style={{ height: rowHeight }}>
                    {/* 在席レイヤー（背景） */}
                    <div className="absolute inset-0 flex">
                      {row.presence.map((present, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-9 min-w-9 shrink-0 h-full",
                            i % 2 === 0 && "border-l border-border",
                            present
                              ? (i === currentSlotIndex
                                  ? "bg-primary/40 dark:bg-primary/50"
                                  : "bg-primary/20 dark:bg-primary/30")
                              : row.lunchBreak[i] && "bg-yellow-100 dark:bg-yellow-900/30",
                            present && isClickable && "cursor-pointer hover:opacity-80"
                          )}
                          onClick={present && isClickable ? () => onShiftCellClick!(todayShift!) : undefined}
                        />
                      ))}
                    </div>
                    {/* 業務バーオーバーレイ */}
                    {hasDuties && (
                      <div className="absolute inset-x-0 top-0" onClick={(e) => e.stopPropagation()}>
                        <DutyBarsOverlay
                          bars={empBars}
                          axisStartMinutes={axisStartMinutes}
                          axisEndMinutes={axisEndMinutes}
                          laneHeight={20}
                          laneGap={2}
                          onBarClick={setSelectedDutyId}
                        />
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* フッター: 合計行 */}
        <tfoot className="sticky bottom-0 z-20">
          <tr className="border-t-2 border-border">
            <td className="sticky left-0 z-30 bg-muted px-3 py-1.5 font-semibold shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              合計
            </td>
            {slotCounts.map((count, i) => (
              <td
                key={i}
                className={cn(
                  "bg-muted w-9 min-w-9 px-0 py-1.5 text-center font-semibold",
                  i % 2 === 0 && "border-l border-border",
                  count === 0
                    ? "text-muted-foreground"
                    : i === currentSlotIndex
                      ? "bg-primary/20 dark:bg-primary/30"
                      : ""
                )}
              >
                {count}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      </div>

      {/* 業務割当詳細ダイアログ */}
      <DutyAssignmentDetailDialog
        open={selectedDutyId !== null}
        onOpenChange={(open) => { if (!open) setSelectedDutyId(null) }}
        duty={selectedDuty}
        isAuthenticated={isAuthenticated}
        employees={employees}
        dutyTypes={dutyTypes}
      />
    </div>
  )
}
