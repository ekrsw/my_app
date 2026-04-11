"use client"

import { useMemo } from "react"
import { getTimeHHMM } from "@/lib/capacity-utils"
import {
  DutyBarsOverlay,
  computeLaneCount,
  computeRowHeight,
  type DutyBarInput,
} from "@/components/common/duty-bars-overlay"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type DutyDailyTimelineProps = {
  data: DutyAssignmentWithDetails[]
}

type EmployeeRow = {
  employeeId: string
  employeeName: string
  bars: DutyBarInput[]
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
  const { employeeRows, axisStartMinutes, axisEndMinutes, hourLabels } = useMemo(() => {
    if (data.length === 0) {
      return {
        employeeRows: [],
        axisStartMinutes: DEFAULT_START_HOUR * 60,
        axisEndMinutes: DEFAULT_END_HOUR * 60,
        hourLabels: [],
      }
    }

    const employeeMap = new Map<
      string,
      {
        name: string
        duties: { duty: DutyAssignmentWithDetails; startMin: number; endMin: number }[]
      }
    >()

    let globalMin = DEFAULT_START_HOUR * 60
    let globalMax = DEFAULT_END_HOUR * 60

    for (const duty of data) {
      if (!duty.startTime || !duty.endTime) continue

      const startHHMM = getTimeHHMM(duty.startTime)
      const endHHMM = getTimeHHMM(duty.endTime)
      let startMin = timeToMinutes(startHHMM)
      let endMin = timeToMinutes(endHHMM)

      // 日跨ぎ業務: 当日分のみ (startTime → 24:00)
      if (endMin < startMin) {
        endMin = 24 * 60
      }

      if (startMin < globalMin) globalMin = startMin
      if (endMin > globalMax) globalMax = endMin

      const empId = duty.employeeId
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, { name: duty.employee.name, duties: [] })
      }
      employeeMap.get(empId)!.duties.push({ duty, startMin, endMin })
    }

    // 時間軸をフル時間に丸める
    const axisStart = Math.floor(globalMin / 60) * 60
    const axisEnd = Math.ceil(globalMax / 60) * 60

    // DutyBarInput に変換（レーン計算は DutyBarsOverlay に委譲）
    const rows: EmployeeRow[] = []

    for (const [empId, { name, duties }] of employeeMap) {
      const bars: DutyBarInput[] = duties.map(({ duty, startMin, endMin }) => ({
        id: duty.id,
        dutyTypeName: duty.dutyType.name,
        color: duty.dutyType.color,
        startMinutes: startMin,
        endMinutes: endMin,
        employeeName: name,
      }))

      rows.push({ employeeId: empId, employeeName: name, bars })
    }

    rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ja"))

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

  return (
    <div className="mb-4 rounded-md border bg-background overflow-x-auto">
      {/* 時間軸ヘッダー */}
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

      {/* 従業員ごとの行 */}
      {employeeRows.map((empRow) => {
        const laneCount = computeLaneCount(empRow.bars)
        const rowHeight = computeRowHeight(laneCount, LANE_HEIGHT, LANE_GAP)

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
              {/* グリッド線 */}
              {hourLabels.map((m) => (
                <div
                  key={m}
                  className="absolute top-0 h-full border-l border-dashed border-border/40"
                  style={{ left: `${getLeftPercent(m)}%` }}
                />
              ))}

              {/* 業務バー（共有コンポーネント） */}
              <DutyBarsOverlay
                bars={empRow.bars}
                axisStartMinutes={axisStartMinutes}
                axisEndMinutes={axisEndMinutes}
                laneHeight={LANE_HEIGHT}
                laneGap={LANE_GAP}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
