"use client"

import { useMemo } from "react"
import type { ShiftCalendarData } from "@/types/shifts"
import { ShiftCalendarCell } from "./shift-calendar-cell"
import { useShiftCalendar } from "@/hooks/use-shift-calendar"
import {
  getDaysInMonth,
  getDayOfWeekJa,
  isWeekend as checkWeekend,
  isToday as checkToday,
  toDateString,
} from "@/lib/date-utils"
import { ChevronDown, ChevronRight } from "lucide-react"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ShiftCalendarProps = {
  data: ShiftCalendarData[]
  year: number
  month: number
  onCellClick?: (employeeId: number, date: string, shiftId?: number) => void
  selectedCells?: Set<string>
  onCellSelect?: (cellKey: string) => void
}

export function ShiftCalendar({
  data,
  year,
  month,
  onCellClick,
  selectedCells: externalSelectedCells,
  onCellSelect,
}: ShiftCalendarProps) {
  const days = useMemo(() => getDaysInMonth(year, month), [year, month])
  const { groupedData, selectedCells: internalSelectedCells, toggleGroup } = useShiftCalendar(data)
  const selectedCells = externalSelectedCells ?? internalSelectedCells

  return (
    <ScrollArea className="w-full rounded-md border">
      <div className="min-w-max">
        {/* Header row */}
        <div className="flex sticky top-0 z-20 bg-background border-b">
          <div className="sticky left-0 z-30 flex w-48 min-w-48 items-center border-r bg-background px-3 py-2 text-sm font-medium">
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
              className="flex sticky top-[42px] z-10 bg-muted/50 border-b cursor-pointer hover:bg-muted/80"
              onClick={() => toggleGroup(group.groupId)}
            >
              <div className="sticky left-0 z-20 flex w-48 min-w-48 items-center gap-1 border-r bg-muted/50 px-3 py-1.5 text-sm font-medium">
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
                          onClick={() => onCellClick?.(emp.employeeId, dateStr, shift?.id)}
                          onSelect={() => onCellSelect?.(cellKey)}
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
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
