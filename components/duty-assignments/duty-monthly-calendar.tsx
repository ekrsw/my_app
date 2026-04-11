"use client"

import { useMemo, useState, useCallback, useRef, useEffect, useId } from "react"
import type { DutyCalendarData, DutyCalendarCell, ShiftCodeMap } from "@/types/duties"
import { COLOR_PALETTE, getShiftCodeInfo, type ShiftCodeInfo } from "@/lib/constants"
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
import { DutyCellDialog } from "@/components/duty-assignments/duty-cell-dialog"
import { Loader2 } from "lucide-react"

type DutyMonthlyCalendarProps = {
  data: DutyCalendarData[]
  year: number
  month: number
  selectedEmployeeIds: string[]
  onEdit: (assignmentId: number) => void
  onDelete: (assignmentId: number) => void
  onAddNew: (dateStr: string, employeeId: string) => void
  onShiftCellClick: (employeeId: string, date: string, employeeName: string) => void
  isAuthenticated: boolean
  editLoadingId: number | null
  deleteLoadingId: number | null
  employeeSearchText: string
  shiftCodeMap: ShiftCodeMap
  shiftCodeInfoMap: Record<string, ShiftCodeInfo>
  total: number
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
}

const MAX_VISIBLE_TITLES = 2

function DutyTitleRow({ cell }: { cell: DutyCalendarCell }) {
  const palette = cell.dutyTypeColor
    ? COLOR_PALETTE[cell.dutyTypeColor] ?? COLOR_PALETTE["gray"]
    : COLOR_PALETTE["gray"]

  const displayText = cell.title ?? "未入力"
  const isMissing = !cell.title

  return (
    <div
      className={cn(
        "truncate text-[10px] leading-4",
        isMissing ? "text-muted-foreground" : palette.text
      )}
      title={`${cell.dutyTypeName}: ${displayText} (${cell.startTime}-${cell.endTime})`}
    >
      {displayText}
    </div>
  )
}

function ShiftArea({
  shiftCode,
  shiftCodeInfoMap,
  onClick,
}: {
  shiftCode: string | undefined
  shiftCodeInfoMap: Record<string, ShiftCodeInfo>
  onClick: (e: React.MouseEvent) => void
}) {
  const shiftInfo = shiftCode ? getShiftCodeInfo(shiftCode, shiftCodeInfoMap) : null

  return (
    <div
      className="flex items-center justify-center shrink-0 cursor-pointer hover:bg-accent/20 transition-colors px-1 py-0.5"
      onClick={onClick}
    >
      {shiftInfo ? (
        <span
          className={cn(
            "text-[10px] font-medium rounded px-1 leading-tight",
            shiftInfo.bgColor,
            shiftInfo.color
          )}
        >
          {shiftCode}
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground/40">-</span>
      )}
    </div>
  )
}

function DutyArea({
  duties,
  shiftCode,
  shiftCodeInfoMap,
  onClick,
}: {
  duties: DutyCalendarCell[] | undefined
  shiftCode: string | undefined
  shiftCodeInfoMap: Record<string, ShiftCodeInfo>
  onClick: (e: React.MouseEvent) => void
}) {
  const hasDuties = duties && duties.length > 0
  const shiftInfo = shiftCode ? getShiftCodeInfo(shiftCode, shiftCodeInfoMap) : null

  const visible = hasDuties ? duties.slice(0, MAX_VISIBLE_TITLES) : []
  const remaining = hasDuties ? duties.length - MAX_VISIBLE_TITLES : 0

  return (
    <div
      className="flex-[4] overflow-hidden cursor-pointer hover:bg-accent/30 transition-colors px-1 py-0.5"
      onClick={onClick}
    >
      {hasDuties ? (
        <>
          {visible.map((cell) => (
            <DutyTitleRow key={cell.id} cell={cell} />
          ))}
          {remaining > 0 && (
            <div className="text-[9px] text-muted-foreground leading-4 truncate">
              他{remaining}件
            </div>
          )}
        </>
      ) : (
        !shiftInfo && (
          <span className="text-muted-foreground text-[10px]">-</span>
        )
      )}
    </div>
  )
}

export function DutyMonthlyCalendar({
  data,
  year,
  month,
  selectedEmployeeIds,
  onEdit,
  onDelete,
  onAddNew,
  onShiftCellClick,
  isAuthenticated,
  editLoadingId,
  deleteLoadingId,
  employeeSearchText,
  shiftCodeMap,
  shiftCodeInfoMap,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: DutyMonthlyCalendarProps) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const { setParams } = useQueryParams()
  const [employeePopoverOpen, setEmployeePopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{
    dateStr: string
    employeeId: string
    employeeName: string
  } | null>(null)

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

  const selectedDuties = useMemo(() => {
    if (!selectedCell) return []
    const emp = data.find((e) => e.employeeId === selectedCell.employeeId)
    return emp?.duties[selectedCell.dateStr] ?? []
  }, [data, selectedCell])

  const handleCellClick = useCallback(
    (dateStr: string, employeeId: string, employeeName: string) => {
      setSelectedCell({ dateStr, employeeId, employeeName })
      setDialogOpen(true)
    },
    []
  )

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open)
    if (!open) setSelectedCell(null)
  }, [])

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
              const shiftCode = shiftCodeMap[emp.employeeId]?.[dateStr]
              const weekend = checkWeekend(day)
              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[4rem] w-16 min-w-16 border-r flex flex-col",
                    weekend && "bg-red-50/50"
                  )}
                >
                  <ShiftArea
                    shiftCode={shiftCode}
                    shiftCodeInfoMap={shiftCodeInfoMap}
                    onClick={(e) => {
                      e.stopPropagation()
                      onShiftCellClick(emp.employeeId, dateStr, emp.employeeName)
                    }}
                  />
                  <DutyArea
                    duties={duties}
                    shiftCode={shiftCode}
                    shiftCodeInfoMap={shiftCodeInfoMap}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCellClick(dateStr, emp.employeeId, emp.employeeName)
                    }}
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
      {selectedCell && (
        <DutyCellDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          duties={selectedDuties}
          dateStr={selectedCell.dateStr}
          employeeId={selectedCell.employeeId}
          employeeName={selectedCell.employeeName}
          isAuthenticated={isAuthenticated}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddNew={onAddNew}
          editLoadingId={editLoadingId}
          deleteLoadingId={deleteLoadingId}
        />
      )}
    </div>
  )
}
