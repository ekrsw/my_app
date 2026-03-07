"use client"

import { useMemo, useEffect, useRef, useId, useState } from "react"
import type { ShiftCalendarData } from "@/types/shifts"
import type { ShiftCodeInfo } from "@/lib/constants"
import { ShiftCalendarCell } from "./shift-calendar-cell"
import { useShiftCalendar } from "@/hooks/use-shift-calendar"
import {
  getDaysInMonth,
  getDayOfWeekJa,
  isWeekend as checkWeekend,
  isToday as checkToday,
  toDateString,
} from "@/lib/date-utils"
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { StickyHorizontalScrollbar } from "@/components/ui/sticky-horizontal-scrollbar"

type ShiftCalendarProps = {
  data: ShiftCalendarData[]
  year: number
  month: number
  onCellClick?: (employeeId: string, date: string, shiftId?: number) => void
  selectedCells?: Set<string>
  onCellSelect?: (cellKey: string) => void
  shiftCodeMap?: Record<string, ShiftCodeInfo>
  shiftIdsWithHistory?: Set<number>
  hasMore?: boolean
  isLoadingMore?: boolean
  onLoadMore?: () => void
  total?: number
}

export function ShiftCalendar({
  data,
  year,
  month,
  onCellClick,
  selectedCells: externalSelectedCells,
  onCellSelect,
  shiftCodeMap,
  shiftIdsWithHistory,
  hasMore,
  isLoadingMore,
  onLoadMore,
  total,
}: ShiftCalendarProps) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const { groupedData, selectedCells: internalSelectedCells, toggleGroup } = useShiftCalendar(data)
  const selectedCells = externalSelectedCells ?? internalSelectedCells

  const scrollContainerId = useId()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore
  }, [onLoadMore])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const updateHeight = () => {
      const rect = container.getBoundingClientRect()
      const available = window.innerHeight - rect.top - 24
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
  }, [])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreRef.current?.()
        }
      },
      { root: container, rootMargin: "200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore])

  const calendar = (
    <div
      id={scrollContainerId}
      ref={scrollContainerRef}
      className="w-full overflow-auto rounded-md border"
      style={{ maxHeight }}
    >
      <div className="min-w-max">
        {/* Header row */}
        <div className="flex h-10 sticky top-0 z-20 bg-background border-b">
          <div className="sticky left-0 z-30 flex w-48 min-w-48 items-center border-r bg-background px-3 text-sm font-medium">
            従業員
          </div>
          {days.map((day) => {
            const weekend = checkWeekend(day)
            const today = checkToday(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex w-12 min-w-12 flex-col items-center border-r py-1 text-xs",
                  weekend && "bg-red-50 text-red-600",
                  today && "bg-primary/5 font-bold"
                )}
              >
                <span>{day.getDate()}</span>
                <span className="text-[10px]">{getDayOfWeekJa(day)}</span>
              </div>
            )
          })}
        </div>

        {/* Body rows */}
        {groupedData.map((group) => (
          <div key={group.groupId ?? "ungrouped"}>
            {/* Group header */}
            <div
              className="flex sticky top-10 z-[15] bg-muted border-b cursor-pointer hover:bg-muted/80"
              onClick={() => toggleGroup(group.groupId)}
            >
              <div className="sticky left-0 z-20 flex w-48 min-w-48 items-center gap-1 border-r bg-muted px-3 py-1.5 text-sm font-medium">
                {group.collapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                {group.groupName ?? "未所属"}
                <span className="ml-1 text-muted-foreground text-xs">
                  ({group.employees.length})
                </span>
              </div>
              <div className="flex-1" />
            </div>

            {/* Employee rows */}
            {!group.collapsed &&
              group.employees.map((emp) => (
                <div key={emp.employeeId} className="flex border-b hover:bg-muted/20">
                  <div className="sticky left-0 z-10 flex w-48 min-w-48 items-center border-r bg-background px-3 py-0 text-sm truncate">
                    {emp.employeeName}
                  </div>
                  {days.map((day) => {
                    const dateStr = toDateString(day)
                    const shift = emp.shifts[dateStr]
                    const cellKey = `${emp.employeeId}:${dateStr}`
                    return (
                      <div key={dateStr} className="h-8 w-12 min-w-12">
                        <ShiftCalendarCell
                          shift={shift}
                          isWeekend={checkWeekend(day)}
                          isToday={checkToday(day)}
                          isSelected={selectedCells.has(cellKey)}
                          hasHistory={shift?.id != null && (shiftIdsWithHistory?.has(shift.id) ?? false)}
                          onClick={() => onCellClick?.(emp.employeeId, dateStr, shift?.id)}
                          onSelect={() => onCellSelect?.(cellKey)}
                          shiftCodeMap={shiftCodeMap}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
          </div>
        ))}

        {data.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            データがありません
          </div>
        )}

        {/* センチネル要素 + ローディング表示 */}
        {data.length > 0 && hasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-4">
            {isLoadingMore && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* 件数表示 */}
      {total != null && data.length > 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t">
          {data.length} / 全{total}人 表示中
          {hasMore && !isLoadingMore && " — スクロールで続きを読み込み"}
        </div>
      )}
    </div>
  )

  return (
    <>
      {calendar}
      {/* Fixed 横スクロールバー（ビューポート下部に固定） */}
      <StickyHorizontalScrollbar
        containerRef={scrollContainerRef}
        containerId={scrollContainerId}
      />
    </>
  )
}
