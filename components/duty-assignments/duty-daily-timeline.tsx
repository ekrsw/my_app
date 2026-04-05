"use client"

import { useMemo, useState } from "react"
import { getTimeHHMM } from "@/lib/capacity-utils"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type DutyDailyTimelineProps = {
  data: DutyAssignmentWithDetails[]
}

type DutyBar = {
  duty: DutyAssignmentWithDetails
  startMinutes: number
  endMinutes: number
  lane: number
}

type EmployeeRow = {
  employeeId: string
  employeeName: string
  bars: DutyBar[]
  laneCount: number
}

/** "HH:mm" -> total minutes from 00:00 */
function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

/** minutes -> "HH:mm" */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 22
const LANE_HEIGHT = 28
const LANE_GAP = 2

export function DutyDailyTimeline({ data }: DutyDailyTimelineProps) {
  const [hoveredDutyId, setHoveredDutyId] = useState<number | null>(null)

  const { employeeRows, axisStartMinutes, axisEndMinutes, hourLabels } = useMemo(() => {
    if (data.length === 0) {
      return {
        employeeRows: [],
        axisStartMinutes: DEFAULT_START_HOUR * 60,
        axisEndMinutes: DEFAULT_END_HOUR * 60,
        hourLabels: [],
      }
    }

    // Gather all duties by employee
    const employeeMap = new Map<string, {
      name: string
      duties: { duty: DutyAssignmentWithDetails; startMin: number; endMin: number }[]
    }>()

    let globalMin = DEFAULT_START_HOUR * 60
    let globalMax = DEFAULT_END_HOUR * 60

    for (const duty of data) {
      if (!duty.startTime || !duty.endTime) continue

      const startHHMM = getTimeHHMM(duty.startTime)
      const endHHMM = getTimeHHMM(duty.endTime)
      let startMin = timeToMinutes(startHHMM)
      let endMin = timeToMinutes(endHHMM)

      // Overnight duty: only show current day portion (startTime to 24:00)
      if (endMin < startMin) {
        endMin = 24 * 60
      }

      // Auto-extend axis range
      if (startMin < globalMin) globalMin = startMin
      if (endMin > globalMax) globalMax = endMin

      const empId = duty.employeeId
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, { name: duty.employee.name, duties: [] })
      }
      employeeMap.get(empId)!.duties.push({ duty, startMin, endMin })
    }

    // Snap to full hours
    const axisStart = Math.floor(globalMin / 60) * 60
    const axisEnd = Math.ceil(globalMax / 60) * 60

    // Build employee rows with lane assignment (greedy algorithm)
    const rows: EmployeeRow[] = []

    for (const [empId, { name, duties }] of employeeMap) {
      // Sort by start time
      const sorted = [...duties].sort((a, b) => a.startMin - b.startMin)

      // Greedy lane assignment: track end time per lane
      const laneEnds: number[] = []
      const bars: DutyBar[] = []

      for (const { duty, startMin, endMin } of sorted) {
        // Find first lane where this duty fits
        let assignedLane = -1
        for (let i = 0; i < laneEnds.length; i++) {
          if (laneEnds[i] <= startMin) {
            assignedLane = i
            laneEnds[i] = endMin
            break
          }
        }
        if (assignedLane === -1) {
          assignedLane = laneEnds.length
          laneEnds.push(endMin)
        }

        bars.push({ duty, startMinutes: startMin, endMinutes: endMin, lane: assignedLane })
      }

      rows.push({
        employeeId: empId,
        employeeName: name,
        bars,
        laneCount: Math.max(laneEnds.length, 1),
      })
    }

    // Sort by employee name
    rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ja"))

    // Hour labels
    const labels: number[] = []
    for (let m = axisStart; m <= axisEnd; m += 60) {
      labels.push(m)
    }

    return {
      employeeRows: rows,
      axisStartMinutes: axisStart,
      axisEndMinutes: axisEnd,
      hourLabels: labels,
    }
  }, [data])

  if (data.length === 0 || employeeRows.length === 0) {
    return null
  }

  const totalAxisMinutes = axisEndMinutes - axisStartMinutes
  const NAME_COL_WIDTH = 120

  function getLeftPercent(minutes: number): number {
    return ((minutes - axisStartMinutes) / totalAxisMinutes) * 100
  }

  function getWidthPercent(startMin: number, endMin: number): number {
    return ((endMin - startMin) / totalAxisMinutes) * 100
  }

  return (
    <div className="mb-4 rounded-md border bg-background overflow-x-auto">
      {/* Time axis header */}
      <div className="flex border-b">
        <div
          className="shrink-0 text-xs text-muted-foreground font-medium px-2 py-1 border-r bg-muted/30"
          style={{ width: NAME_COL_WIDTH }}
        >
          従業員
        </div>
        <div className="relative flex-1 h-7">
          {hourLabels.map((m) => (
            <div
              key={m}
              className="absolute top-0 h-full flex items-center"
              style={{ left: `${getLeftPercent(m)}%` }}
            >
              <span className="text-[10px] text-muted-foreground -translate-x-1/2">
                {minutesToTime(m).substring(0, 2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Employee rows */}
      {employeeRows.map((empRow) => {
        const rowHeight = empRow.laneCount * LANE_HEIGHT + (empRow.laneCount - 1) * LANE_GAP + 8

        return (
          <div key={empRow.employeeId} className="flex border-b last:border-b-0">
            <div
              className="shrink-0 text-xs font-medium px-2 flex items-center border-r bg-muted/10 truncate"
              style={{ width: NAME_COL_WIDTH }}
              title={empRow.employeeName}
            >
              {empRow.employeeName}
            </div>
            <div
              className="relative flex-1"
              style={{ height: rowHeight }}
            >
              {/* Grid lines */}
              {hourLabels.map((m) => (
                <div
                  key={m}
                  className="absolute top-0 h-full border-l border-dashed border-border/40"
                  style={{ left: `${getLeftPercent(m)}%` }}
                />
              ))}

              {/* Duty bars */}
              {empRow.bars.map((bar) => {
                const palette = bar.duty.dutyType.color
                  ? COLOR_PALETTE[bar.duty.dutyType.color]
                  : null
                const bgClass = palette?.bg ?? "bg-gray-200"
                const textClass = palette?.text ?? "text-gray-800"
                const isHovered = hoveredDutyId === bar.duty.id

                const topOffset = 4 + bar.lane * (LANE_HEIGHT + LANE_GAP)

                return (
                  <div
                    key={bar.duty.id}
                    className={cn(
                      "absolute rounded-sm border border-border/50 flex items-center px-1.5 overflow-hidden transition-shadow",
                      bgClass,
                      textClass,
                      isHovered && "shadow-md ring-1 ring-primary/30 z-10"
                    )}
                    style={{
                      left: `${getLeftPercent(bar.startMinutes)}%`,
                      width: `${getWidthPercent(bar.startMinutes, bar.endMinutes)}%`,
                      top: topOffset,
                      height: LANE_HEIGHT,
                      minWidth: 4,
                    }}
                    onMouseEnter={() => setHoveredDutyId(bar.duty.id)}
                    onMouseLeave={() => setHoveredDutyId(null)}
                  >
                    <span className="text-[10px] font-medium truncate leading-tight">
                      {bar.duty.dutyType.name}
                    </span>

                    {/* Tooltip */}
                    {isHovered && (
                      <div
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none"
                      >
                        <div className="bg-popover text-popover-foreground border rounded-md shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap">
                          <p className="font-medium">{bar.duty.employee.name}</p>
                          <p>{bar.duty.dutyType.name}</p>
                          <p className="text-muted-foreground">
                            {getTimeHHMM(bar.duty.startTime!)} - {getTimeHHMM(bar.duty.endTime!)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
