"use client"

import type { Shift } from "@/app/generated/prisma/client"
import { getShiftCodeInfo } from "@/lib/constants"
import { formatTime } from "@/lib/date-utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type ShiftCalendarCellProps = {
  shift?: Shift
  isWeekend: boolean
  isToday: boolean
  isSelected: boolean
  onClick: () => void
  onSelect?: () => void
}

export function ShiftCalendarCell({
  shift,
  isWeekend,
  isToday,
  isSelected,
  onClick,
  onSelect,
}: ShiftCalendarCellProps) {
  const code = shift?.shiftCode ?? null
  const info = getShiftCodeInfo(code)

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onSelect) {
      e.preventDefault()
      onSelect()
    } else {
      onClick()
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "relative h-full w-full text-xs font-medium transition-colors cursor-pointer",
            "border-r border-b border-border/50",
            "hover:ring-2 hover:ring-primary/30 hover:z-10",
            info.bgColor,
            info.color,
            isWeekend && "bg-red-50",
            isToday && "ring-1 ring-primary z-10",
            isSelected && "ring-2 ring-primary bg-primary/10 z-20"
          )}
        >
          {code ?? ""}
        </button>
      </TooltipTrigger>
      {shift && (
        <TooltipContent side="top" className="text-xs">
          <div className="space-y-1">
            <div className="font-medium">{info.label}</div>
            {shift.startTime && (
              <div>
                {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
              </div>
            )}
            <div className="flex gap-1">
              {shift.isHoliday && <span className="text-red-600">休日</span>}
              {shift.isPaidLeave && <span className="text-green-600">有給</span>}
              {shift.isRemote && <span className="text-sky-600">テレワーク</span>}
            </div>
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  )
}
