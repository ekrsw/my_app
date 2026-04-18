"use client"

import { ReactNode, useMemo, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Home } from "lucide-react"
import { getTimeHHMM, getCurrentJSTTimeHHMM, isLunchBreak, getCapacityColor, getTodayJSTDateStr, isRoleActiveToday } from "@/lib/capacity-utils"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { CheckboxListFilter } from "@/components/common/filters/checkbox-list-filter"
import { ToggleFilter } from "@/components/common/filters/toggle-filter"
import { DutyBarsOverlay, computeLaneCount, computeRowHeight, type DutyBarInput } from "@/components/common/duty-bars-overlay"
import { DutyAssignmentDetailDialog } from "@/components/duty-assignments/duty-assignment-detail-dialog"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import type { ShiftCodeInfo } from "@/lib/constants"
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

/**
 * employeeId → TodayShift のマップを構築する。
 * 今日のシフトと前日夜勤シフトの両方を考慮し、今日のシフトを優先する。
 * (前日夜勤のみ出勤の従業員もMapに登場するが、今日のシフトがあればそれで上書きされる)
 */
export function buildShiftDisplayMap(
  shifts: TodayShift[],
  overnightShifts: TodayShift[]
): Map<string, TodayShift> {
  const map = new Map<string, TodayShift>()
  for (const shift of overnightShifts) {
    const empId = shift.employee?.id
    if (empId) map.set(empId, shift)
  }
  for (const shift of shifts) {
    const empId = shift.employee?.id
    if (empId) map.set(empId, shift)
  }
  return map
}

/** フッター統計行の型 */
export type SlotStat = {
  present: number
  sv: number
  lunch: number
  onDuty: number
  available: number
}

/** フッター統計を計算する純粋関数 */
export function computeSlotStats(
  filteredGrid: MergedRow[],
  timeSlots: string[],
  duties: DutyAssignmentWithDetails[] | undefined,
  distinctRoleTypes: readonly [string, string],
): SlotStat[] {
  // 業務割当のスロット判定（reducesCapacity=true のみ、日跨ぎ対応）
  const dutyPresence = new Map<string, boolean[]>()
  if (duties) {
    for (const duty of duties) {
      if (!duty.startTime || !duty.endTime || !duty.reducesCapacity) continue
      const start = getTimeHHMM(duty.startTime)
      const end = getTimeHHMM(duty.endTime)
      const isOvernight = end < start
      const slots = timeSlots.map(slot =>
        isOvernight
          ? (slot >= start || slot < end)
          : (start <= slot && slot < end)
      )
      const existing = dutyPresence.get(duty.employeeId)
      if (existing) {
        dutyPresence.set(duty.employeeId, existing.map((v, i) => v || slots[i]))
      } else {
        dutyPresence.set(duty.employeeId, slots)
      }
    }
  }

  // SV判定（roleType=distinctRoleTypes[0]、有効期間内）
  const todayStr = getTodayJSTDateStr()
  const isSV = (emp: MergedRow["employee"]) =>
    emp?.functionRoles?.some(r =>
      r.functionRole?.roleType === distinctRoleTypes[0] &&
      isRoleActiveToday(r.startDate, r.endDate, todayStr)
    ) ?? false

  return timeSlots.map((_, i) => {
    let present = 0, sv = 0, lunch = 0, onDuty = 0, unavailable = 0
    for (const row of filteredGrid) {
      const isAtWork = row.presence[i] || row.lunchBreak[i]
      if (!isAtWork) continue
      present++
      const isOnLunch = row.lunchBreak[i]
      const isOnDuty = dutyPresence.get(row.employeeId)?.[i] ?? false
      if (isOnLunch || isOnDuty) unavailable++
      if (isOnLunch) lunch++
      if (isOnDuty) onDuty++
      // 対応可能なSVのみカウント（昼休憩中・他業務中を除外）
      if (isSV(row.employee) && !isOnLunch && !isOnDuty) sv++
    }
    return {
      present,
      sv,
      lunch,
      onDuty,
      available: Math.max(0, present - unavailable),
    }
  })
}

/** 時間ラベル（08, 09, ... 21）*/
const HOUR_LABELS_DAY = Array.from({ length: 14 }, (_, i) => i + 8)
/** 時間ラベル（00, 01, ... 23）*/
const HOUR_LABELS_FULL = Array.from({ length: 24 }, (_, i) => i)

type FilterOption = { value: string; label: ReactNode; searchText?: string }

export type MergedRow = {
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
  // シフトコードフィルター + バッジ表示
  shiftCodeMap: Record<string, ShiftCodeInfo>
  shiftCodeOptions: FilterOption[]
  selectedShiftCodes: string[]
  shiftCodePopoverOpen: boolean
  onShiftCodePopoverOpenChange: (open: boolean) => void
  onShiftCodesConfirm: (codes: string[]) => void
  onShiftCodesClear: () => void
  // テレワークフィルター
  isRemoteFilter: boolean
  twPopoverOpen: boolean
  onTwPopoverOpenChange: (open: boolean) => void
  onTwFilterChange: (checked: boolean) => void
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
  shiftCodeMap,
  shiftCodeOptions,
  selectedShiftCodes,
  shiftCodePopoverOpen,
  onShiftCodePopoverOpenChange,
  onShiftCodesConfirm,
  onShiftCodesClear,
  isRemoteFilter,
  twPopoverOpen,
  onTwPopoverOpenChange,
  onTwFilterChange,
  isAuthenticated = false,
  employees = [],
  dutyTypes = [],
}: Props) {
  const [currentTime, setCurrentTime] = useState(getCurrentJSTTimeHHMM)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>(600)
  const [selectedDutyId, setSelectedDutyId] = useState<number | null>(null)
  const [footerExpanded, setFooterExpanded] = useState(false)

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

  // シフト列表示用: 今日 + 前日夜勤をマージ (今日優先)
  const shiftByEmployeeIdForDisplay = useMemo(
    () => buildShiftDisplayMap(shifts, overnightShifts),
    [shifts, overnightShifts]
  )

  // セルクリック用: 今日のシフトのみ (前日夜勤のみの行はクリック不可のまま)
  const shiftByEmployeeIdForClick = useMemo(() => {
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

  const slotStats = useMemo(
    () => computeSlotStats(filteredGrid, timeSlots, duties, distinctRoleTypes),
    [filteredGrid, timeSlots, duties, distinctRoleTypes]
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
        <ColumnFilterPopover
          label="シフト"
          isActive={selectedShiftCodes.length > 0}
          activeCount={selectedShiftCodes.length}
          open={shiftCodePopoverOpen}
          onOpenChange={onShiftCodePopoverOpenChange}
        >
          <CheckboxListFilter
            options={shiftCodeOptions}
            selectedValues={selectedShiftCodes}
            onConfirm={onShiftCodesConfirm}
            onClear={onShiftCodesClear}
            popoverOpen={shiftCodePopoverOpen}
            searchPlaceholder="シフトコードで検索..."
          />
        </ColumnFilterPopover>
        <ColumnFilterPopover
          label="TW"
          isActive={isRemoteFilter}
          open={twPopoverOpen}
          onOpenChange={onTwPopoverOpenChange}
        >
          <ToggleFilter
            checked={isRemoteFilter}
            onChange={onTwFilterChange}
            label="TWのみ表示"
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
              className="sticky left-0 z-30 w-[120px] min-w-[120px] max-w-[120px] bg-background px-3 py-1.5 text-left font-medium"
            >
              従業員名
            </th>
            <th
              rowSpan={2}
              className="sticky left-[120px] z-30 w-[72px] min-w-[72px] bg-background px-2 py-1.5 text-left font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]"
            >
              シフト
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
            const todayShift = shiftByEmployeeIdForClick.get(row.employeeId)
            const displayShift = shiftByEmployeeIdForDisplay.get(row.employeeId)
            const isClickable = !!todayShift && !!onShiftCellClick
            return (
              <tr
                key={row.employeeId}
                className={cn(
                  "border-t border-border",
                  isClickable && "cursor-pointer group"
                )}
                onClick={isClickable ? () => onShiftCellClick!(todayShift!) : undefined}
              >
                <td className="sticky left-0 z-10 w-[120px] min-w-[120px] max-w-[120px] bg-background px-3 py-1 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                  {emp ? (
                    <Link
                      href={`/employees/${emp.id}`}
                      className="hover:underline hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                      title={emp.name}
                    >
                      {emp.name}
                    </Link>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="sticky left-[120px] z-10 w-[72px] min-w-[72px] bg-background px-2 py-1 overflow-hidden shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                  {displayShift ? (
                    <div className="relative inline-flex items-center">
                      <ShiftBadge code={displayShift.shiftCode} shiftCodeMap={shiftCodeMap} />
                      {displayShift.isRemote && (
                        <Home
                          aria-label="テレワーク"
                          className="absolute top-0 right-0 h-2.5 w-2.5 text-sky-600"
                        />
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
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
                            isClickable && present && "group-hover:opacity-80",
                            isClickable && !present && row.lunchBreak[i] && "group-hover:bg-yellow-200 dark:group-hover:bg-yellow-800/30",
                            isClickable && !present && !row.lunchBreak[i] && "group-hover:bg-accent"
                          )}
                        />
                      ))}
                    </div>
                    {/* 業務バーオーバーレイ */}
                    {hasDuties && (
                      <div className="absolute inset-x-0 top-0 pointer-events-none [&>*]:pointer-events-auto">
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

        {/* フッター: 統計行 */}
        <tfoot className="sticky bottom-0 z-20">
          {/* 出勤行（トグル付き） */}
          <tr className="border-t-2 border-border">
            <td
              colSpan={2}
              className="sticky left-0 z-30 bg-muted px-3 py-1 font-semibold text-xs shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] cursor-pointer select-none"
              onClick={() => setFooterExpanded((v) => !v)}
            >
              <span className={cn("inline-block transition-transform text-muted-foreground mr-0.5", footerExpanded && "rotate-90")}>▶</span>
              出勤
            </td>
            {slotStats.map((stat, i) => (
              <td
                key={i}
                className={cn(
                  "bg-muted w-9 min-w-9 px-0 py-1 text-center text-xs font-semibold",
                  i % 2 === 0 && "border-l border-border",
                  stat.present === 0
                    ? "text-muted-foreground"
                    : i === currentSlotIndex
                      ? "bg-primary/20 dark:bg-primary/30"
                      : ""
                )}
              >
                {stat.present}
              </td>
            ))}
          </tr>
          {/* 昼休憩行（展開時のみ表示） */}
          {footerExpanded && (
            <tr>
              <td colSpan={2} className="sticky left-0 z-30 bg-muted px-3 py-0.5 pl-6 text-xs text-muted-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                昼休憩
              </td>
              {slotStats.map((stat, i) => (
                <td
                  key={i}
                  className={cn(
                    "bg-muted w-9 min-w-9 px-0 py-0.5 text-center text-xs text-muted-foreground",
                    i % 2 === 0 && "border-l border-border",
                    i === currentSlotIndex && stat.lunch > 0 && "bg-primary/20 dark:bg-primary/30"
                  )}
                >
                  {stat.lunch}
                </td>
              ))}
            </tr>
          )}
          {/* 他業務行（展開時のみ表示） */}
          {footerExpanded && (
            <tr>
              <td colSpan={2} className="sticky left-0 z-30 bg-muted px-3 py-0.5 pl-6 text-xs text-muted-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                他業務
              </td>
              {slotStats.map((stat, i) => (
                <td
                  key={i}
                  className={cn(
                    "bg-muted w-9 min-w-9 px-0 py-0.5 text-center text-xs text-muted-foreground",
                    i % 2 === 0 && "border-l border-border",
                    i === currentSlotIndex && stat.onDuty > 0 && "bg-primary/20 dark:bg-primary/30"
                  )}
                >
                  {stat.onDuty}
                </td>
              ))}
            </tr>
          )}
          {/* 対応可能行 */}
          <tr>
            <td colSpan={2} className="sticky left-0 z-30 bg-muted px-3 py-1 font-semibold text-xs shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              対応可能
            </td>
            {slotStats.map((stat, i) => {
              const color = getCapacityColor(stat.available)
              return (
                <td
                  key={i}
                  className={cn(
                    "w-9 min-w-9 px-0 py-1 text-center text-xs font-semibold",
                    i % 2 === 0 && "border-l border-border",
                    color === "green" && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                    color === "yellow" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
                    color === "red" && "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                    i === currentSlotIndex && "ring-1 ring-inset ring-primary/40"
                  )}
                >
                  {stat.available}
                </td>
              )
            })}
          </tr>
          {/* (内SV)行 */}
          <tr>
            <td colSpan={2} className="sticky left-0 z-30 bg-muted px-3 py-0.5 text-xs text-muted-foreground shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
              (内SV)
            </td>
            {slotStats.map((stat, i) => (
              <td
                key={i}
                className={cn(
                  "bg-muted w-9 min-w-9 px-0 py-0.5 text-center text-xs text-muted-foreground",
                  i % 2 === 0 && "border-l border-border",
                  i === currentSlotIndex && stat.sv > 0 && "bg-primary/20 dark:bg-primary/30"
                )}
              >
                ({stat.sv})
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
