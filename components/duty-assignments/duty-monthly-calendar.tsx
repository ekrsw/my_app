"use client"

import { useMemo, useState, useCallback, useRef, useEffect, useId } from "react"
import type { DutyCalendarData, DutyCalendarCell } from "@/types/duties"
import { COLOR_PALETTE } from "@/lib/constants"
import {
  getDaysInMonth,
  getDayOfWeekJa,
  isWeekend as checkWeekend,
  isToday as checkToday,
  toDateString,
} from "@/lib/date-utils"
import { cn } from "@/lib/utils"
import { ColumnFilterPopover } from "@/components/common/filters/column-filter-popover"
import { EmployeeCheckboxFilter } from "@/components/common/filters/employee-checkbox-filter"
import { useQueryParams } from "@/hooks/use-query-params"
import { StickyHorizontalScrollbar } from "@/components/ui/sticky-horizontal-scrollbar"
import { Loader2 } from "lucide-react"

type DutyMonthlyCalendarProps = {
  data: DutyCalendarData[]
  year: number
  month: number
  selectedEmployeeIds: string[]
  onCellClick: (dateStr: string) => void
  employeeSearchText: string
  total: number
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

const MAX_DOTS = 6

function DutyDot({ cell }: { cell: DutyCalendarCell }) {
  const palette = cell.dutyTypeColor
    ? COLOR_PALETTE[cell.dutyTypeColor] ?? COLOR_PALETTE["gray"]
    : COLOR_PALETTE["gray"]

  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full flex-shrink-0", palette.swatch)}
      title={`${cell.dutyTypeName} (${cell.startTime}-${cell.endTime})`}
    />
  )
}

function CellContent({
  duties,
  dateStr,
  onCellClick,
}: {
  duties: DutyCalendarCell[] | undefined
  dateStr: string
  onCellClick: (dateStr: string) => void
}) {
  if (!duties || duties.length === 0) {
    return (
      <button
        type="button"
        aria-label={`${dateStr} の業務割当を追加`}
        className={cn(
          "flex h-full w-full items-center justify-center text-muted-foreground text-[10px]",
          "hover:bg-accent/30 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        onClick={() => onCellClick(dateStr)}
      >
        -
      </button>
    )
  }

  const visible = duties.slice(0, MAX_DOTS)
  const remaining = duties.length - MAX_DOTS

  return (
    <button
      type="button"
      aria-label={`${dateStr} の業務割当を開く`}
      className={cn(
        "flex h-full w-full flex-wrap items-center justify-center gap-0.5 px-1 py-1",
        "hover:bg-accent/30 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
      onClick={() => onCellClick(dateStr)}
    >
      {visible.map((cell) => (
        <DutyDot key={cell.id} cell={cell} />
      ))}
      {remaining > 0 && (
        <span
          className="text-[9px] text-muted-foreground leading-tight"
          aria-label={`他${remaining}件`}
        >
          +{remaining}
        </span>
      )}
    </button>
  )
}

export function DutyMonthlyCalendar({
  data,
  year,
  month,
  selectedEmployeeIds,
  onCellClick,
  employeeSearchText,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: DutyMonthlyCalendarProps) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const { setParams } = useQueryParams()
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)

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

  const employees = useMemo(
    () => data.map((emp) => ({ id: emp.employeeId, name: emp.employeeName })),
    [data]
  )

  const handleEmployeeConfirm = useCallback(
    (ids: string[]) => {
      setParams({ monthlyEmployeeIds: ids.length > 0 ? ids.join(",") : null })
      setEmployeePopoverOpen(false)
    },
    [setParams]
  )

  const handleEmployeeClear = useCallback(() => {
    setParams({ monthlyEmployeeIds: null })
    setEmployeePopoverOpen(false)
  }, [setParams])

  const filteredData = useMemo(() => {
    let result = data
    if (selectedEmployeeIds.length > 0) {
      const idSet = new Set(selectedEmployeeIds)
      result = result.filter((emp) => idSet.has(emp.employeeId))
    }
    if (employeeSearchText) {
      const lower = employeeSearchText.toLowerCase()
      result = result.filter((emp) =>
        emp.employeeName.toLowerCase().includes(lower)
      )
    }
    return result
  }, [data, selectedEmployeeIds, employeeSearchText])

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
          <div className="sticky left-0 z-30 flex w-52 min-w-52 items-center border-r bg-background px-3 text-sm font-medium">
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
                onConfirm={handleEmployeeConfirm}
                onClear={handleEmployeeClear}
                popoverOpen={employeePopoverOpen}
              />
            </ColumnFilterPopover>
          </div>
          {days.map((day) => {
            const weekend = checkWeekend(day)
            const today = checkToday(day)
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex w-16 min-w-16 flex-col items-center border-r py-1 text-xs",
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
        {filteredData.map((emp) => (
          <div key={emp.employeeId} className="flex border-b hover:bg-muted/20">
            <div className="sticky left-0 z-10 flex w-52 min-w-52 items-center border-r bg-background px-3 py-1 text-sm">
              <span className="truncate font-medium">{emp.employeeName}</span>
            </div>
            {days.map((day) => {
              const dateStr = toDateString(day)
              const duties = emp.duties[dateStr]
              const weekend = checkWeekend(day)
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[4rem] w-16 min-w-16 border-r",
                    weekend && "bg-red-50/50"
                  )}
                >
                  <CellContent
                    duties={duties}
                    dateStr={dateStr}
                    onCellClick={onCellClick}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {/* Empty state */}
        {filteredData.length === 0 && (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            該当する業務割当がありません
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
      {data.length > 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t">
          {filteredData.length} / 全{total}人 表示中
          {hasMore && !isLoadingMore && " — スクロールで続きを読み込み"}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-2">
      {calendar}
      <StickyHorizontalScrollbar
        containerRef={scrollContainerRef}
        containerId={scrollContainerId}
      />
    </div>
  )
}
