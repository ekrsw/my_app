"use client"

import { useState } from "react"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"

export type DutyBarInput = {
  id: number
  dutyTypeName: string
  title?: string | null
  color: string | null
  startMinutes: number
  endMinutes: number
  employeeName?: string
}

type LanedBar = {
  bar: DutyBarInput
  lane: number
}

/** グリーディアルゴリズムでレーン割当を計算する */
export function computeLaneAssignments(bars: DutyBarInput[]): LanedBar[] {
  const sorted = [...bars].sort((a, b) => a.startMinutes - b.startMinutes)
  const laneEnds: number[] = []
  const result: LanedBar[] = []

  for (const bar of sorted) {
    let assignedLane = -1
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] <= bar.startMinutes) {
        assignedLane = i
        laneEnds[i] = bar.endMinutes
        break
      }
    }
    if (assignedLane === -1) {
      assignedLane = laneEnds.length
      laneEnds.push(bar.endMinutes)
    }
    result.push({ bar, lane: assignedLane })
  }

  return result
}

/** 使用レーン数を返す */
export function computeLaneCount(bars: DutyBarInput[]): number {
  if (bars.length === 0) return 1
  const assignments = computeLaneAssignments(bars)
  return Math.max(...assignments.map((a) => a.lane)) + 1
}

/** 行の高さを計算する */
export function computeRowHeight(
  laneCount: number,
  laneHeight: number,
  laneGap: number
): number {
  return laneCount * laneHeight + (laneCount - 1) * laneGap + 8
}

type Props = {
  bars: DutyBarInput[]
  axisStartMinutes: number
  axisEndMinutes: number
  laneHeight?: number
  laneGap?: number
  maxLanes?: number
  onBarClick?: (dutyId: number) => void
}

function formatMinutes(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`
}

/**
 * 業務割当をカラーバーとして描画する共有コンポーネント。
 * 重複する業務はレーンを分けてスタッキングされる。
 * DutyDailyTimeline および TimelineHeatmap の両方で利用する。
 */
export function DutyBarsOverlay({
  bars,
  axisStartMinutes,
  axisEndMinutes,
  laneHeight = 24,
  laneGap = 2,
  maxLanes,
  onBarClick,
}: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null)

  if (bars.length === 0) return null

  const totalMinutes = axisEndMinutes - axisStartMinutes
  const laned = computeLaneAssignments(bars)
  const laneCount = Math.max(...laned.map((l) => l.lane)) + 1
  const visibleLaned = maxLanes !== undefined ? laned.filter(({ lane }) => lane < maxLanes) : laned
  const visibleLaneCount = maxLanes !== undefined ? Math.min(maxLanes, laneCount) : laneCount
  const totalHeight = computeRowHeight(visibleLaneCount, laneHeight, laneGap)

  function getLeftPercent(minutes: number): number {
    return ((Math.max(minutes, axisStartMinutes) - axisStartMinutes) / totalMinutes) * 100
  }

  function getWidthPercent(startMin: number, endMin: number): number {
    const clampedStart = Math.max(startMin, axisStartMinutes)
    const clampedEnd = Math.min(endMin, axisEndMinutes)
    if (clampedEnd <= clampedStart) return 0
    return ((clampedEnd - clampedStart) / totalMinutes) * 100
  }

  return (
    <div className="relative w-full" style={{ height: totalHeight }}>
      {visibleLaned.map(({ bar, lane }) => {
        const palette = bar.color ? COLOR_PALETTE[bar.color] : null
        const bgClass = palette?.bg ?? "bg-gray-200"
        const textClass = palette?.text ?? "text-gray-800"
        const isHovered = hoveredId === bar.id
        const topOffset = 4 + lane * (laneHeight + laneGap)
        const widthPct = getWidthPercent(bar.startMinutes, bar.endMinutes)
        if (widthPct <= 0) return null

        return (
          <div
            key={bar.id}
            className={cn(
              "absolute rounded-sm border border-border/50 flex items-center px-1.5 overflow-hidden transition-shadow",
              onBarClick ? "cursor-pointer" : "cursor-default",
              bgClass,
              textClass,
              isHovered && "shadow-md ring-1 ring-primary/30 z-10"
            )}
            style={{
              left: `${getLeftPercent(bar.startMinutes)}%`,
              width: `${widthPct}%`,
              top: topOffset,
              height: laneHeight,
              minWidth: 4,
            }}
            onMouseEnter={() => setHoveredId(bar.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => {
              if (onBarClick) {
                e.stopPropagation()
                onBarClick(bar.id)
              }
            }}
          >
            <span className="text-[10px] font-medium truncate leading-tight">
              {bar.title || bar.dutyTypeName}
            </span>
            {isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 pointer-events-none">
                <div className="bg-popover text-popover-foreground border rounded-md shadow-md px-2.5 py-1.5 text-xs whitespace-nowrap">
                  {bar.employeeName && (
                    <p className="font-medium">{bar.employeeName}</p>
                  )}
                  {bar.title ? (
                    <>
                      <p>{bar.title}</p>
                      <p className="text-muted-foreground">{bar.dutyTypeName}</p>
                    </>
                  ) : (
                    <p>{bar.dutyTypeName}</p>
                  )}
                  <p className="text-muted-foreground">
                    {formatMinutes(bar.startMinutes)} -{" "}
                    {formatMinutes(bar.endMinutes)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
