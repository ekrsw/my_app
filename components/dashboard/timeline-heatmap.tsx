"use client"

import { ReactNode, useMemo, useState, useEffect, useRef } from "react"
import Link from "next/link"
import { getTimeHHMM, getCurrentJSTTimeHHMM } from "@/lib/capacity-utils"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { CheckboxListFilter } from "@/components/common/filters/checkbox-list-filter"
import type { TodayShift } from "@/components/dashboard/today-overview-client"

/** 8:00〜21:30 の30分刻みスロット（28個） */
const TIME_SLOTS: string[] = []
for (let h = 8; h < 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_SLOTS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)
  }
}

/**
 * ヒートマップ用の在席判定。
 * isWorkerPresent (capacity-utils) とは異なるセマンティクス:
 * - 通常シフト: start <= slot < end（終業時刻のスロットは不在扱い）
 * - 深夜跨ぎシフト(end < start): slot >= start のみ（翌日側は今日の出勤者に含めない）
 */
export function isPresent(
  startTime: Date | string | null,
  endTime: Date | string | null,
  slot: string
): boolean {
  if (!startTime) return false
  const start = getTimeHHMM(startTime)
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

/** 時間ラベル（08, 09, ... 21）*/
const HOUR_LABELS = Array.from({ length: 14 }, (_, i) => i + 8)

type FilterOption = { value: string; label: ReactNode; searchText?: string }

type Props = {
  shifts: TodayShift[]
  distinctRoleTypes: readonly [string, string]
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
}

export function TimelineHeatmap({
  shifts,
  distinctRoleTypes,
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
}: Props) {
  const [currentTime, setCurrentTime] = useState(getCurrentJSTTimeHHMM)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [maxHeight, setMaxHeight] = useState<number>(600)

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

  const grid = useMemo(
    () =>
      shifts.map((shift) => ({
        shift,
        presence: TIME_SLOTS.map((slot) =>
          isPresent(shift.startTime, shift.endTime, slot)
        ),
      })),
    [shifts]
  )

  const slotCounts = useMemo(
    () =>
      TIME_SLOTS.map((_, i) =>
        grid.reduce((count, row) => count + (row.presence[i] ? 1 : 0), 0)
      ),
    [grid]
  )

  const currentSlotIndex = useMemo(() => {
    for (let i = TIME_SLOTS.length - 1; i >= 0; i--) {
      if (currentTime >= TIME_SLOTS[i]) return i
    }
    return -1
  }, [currentTime])

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
            {HOUR_LABELS.map((hour) => {
              const slotIdx = (hour - 8) * 2
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
            {TIME_SLOTS.map((slot, i) => {
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
          {grid.map(({ shift, presence }) => {
            const emp = shift.employee
            return (
              <tr key={shift.id} className="border-t border-border">
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
                {presence.map((present, i) => (
                  <td
                    key={i}
                    className={cn(
                      "w-9 min-w-9 h-7 px-0",
                      i % 2 === 0 && "border-l border-border",
                      present &&
                        (i === currentSlotIndex
                          ? "bg-primary/40 dark:bg-primary/50"
                          : "bg-primary/20 dark:bg-primary/30")
                    )}
                  />
                ))}
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
    </div>
  )
}
