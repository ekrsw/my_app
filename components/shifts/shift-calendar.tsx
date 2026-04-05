"use client"

import { useMemo, useEffect, useRef, useId, useState, useCallback } from "react"
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
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { StickyHorizontalScrollbar } from "@/components/ui/sticky-horizontal-scrollbar"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/common/filters/employee-checkbox-filter"
import { useQueryParams } from "@/hooks/use-query-params"

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
  employees?: { id: string; name: string }[]
  selectedEmployeeIds?: string[]
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
  employees = [],
  selectedEmployeeIds = [],
}: ShiftCalendarProps) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const { selectedCells: internalSelectedCells } = useShiftCalendar()
  const selectedCells = externalSelectedCells ?? internalSelectedCells
  const { setParams, searchParams } = useQueryParams()
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)

  const handleEmployeeIdsConfirm = useCallback((ids: string[]) => {
    setParams({ calendarEmployeeIds: ids.length > 0 ? ids.join(",") : null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const handleEmployeeIdsClear = useCallback(() => {
    setParams({ calendarEmployeeIds: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const buildDailyHref = useCallback((day: Date) => {
    const params = new URLSearchParams(searchParams.toString())
    // 月次カレンダー固有のパラメータを除外
    params.delete("calendarEmployeeIds")
    params.delete("search")
    // 日次ビュー用に上書き
    params.set("view", "daily")
    params.set("dailyDate", toDateString(day))
    return `/shifts?${params.toString()}`
  }, [searchParams])

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
            <ColumnFilterPopover
              label="従業員名"
              isActive={selectedEmployeeIds.length > 0}
              activeCount={selectedEmployeeIds.length}
              open={employeePopoverOpen}
              onOpenChange={setEmployeePopoverOpen}
            >
              <EmployeeCheckboxFilter
                employees={employees}
                selectedIds={selectedEmployeeIds}
                onConfirm={handleEmployeeIdsConfirm}
                onClear={handleEmployeeIdsClear}
                popoverOpen={employeePopoverOpen}
              />
            </ColumnFilterPopover>
          </div>
          {days.map((day) => {
            const weekend = checkWeekend(day)
            const today = checkToday(day)
            return (
              <Link
                key={day.toISOString()}
                href={buildDailyHref(day)}
                className={cn(
                  "flex w-12 min-w-12 flex-col items-center border-r py-1 text-xs hover:bg-primary/10 transition-colors",
                  weekend && "bg-red-50 text-red-600",
                  today && "bg-primary/5 font-bold"
                )}
              >
                <span>{day.getDate()}</span>
                <span className="text-[10px]">{getDayOfWeekJa(day)}</span>
              </Link>
            )
          })}
        </div>

        {/* Body rows */}
        {data.map((emp) => (
          <div key={emp.employeeId} className="flex border-b hover:bg-muted/20">
            <div className="sticky left-0 z-10 flex w-48 min-w-48 items-center border-r bg-background px-3 py-0 text-sm truncate">
              <Link href={`/employees/${emp.employeeId}`} className="hover:underline hover:text-primary">
                {emp.employeeName}
              </Link>
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
