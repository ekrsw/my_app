"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  calculateCapacity,
  getCapacityColor,
  getCurrentJSTTimeHHMM,
} from "@/lib/capacity-utils"

type ShiftForCapacity = {
  employeeId: string | null
  startTime: Date | string | null
  endTime: Date | string | null
}

type DutyForCapacity = {
  employeeId: string
  startTime: Date | string
  endTime: Date | string
}

type Props = {
  shifts: ShiftForCapacity[]
  duties: DutyForCapacity[]
}

const COLOR_STYLES = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
} as const

export function CapacitySummary({ shifts, duties }: Props) {
  const [currentTime, setCurrentTime] = useState(getCurrentJSTTimeHHMM)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(getCurrentJSTTimeHHMM())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const { total, onDuty, available } = calculateCapacity(shifts, duties, currentTime)
  const color = getCapacityColor(available)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">対応可能状況</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-muted-foreground">出勤</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{onDuty}</div>
            <div className="text-xs text-muted-foreground">当番中</div>
          </div>
          <div className={cn("rounded-lg px-4 py-2 text-center", COLOR_STYLES[color])}>
            <div className="text-2xl font-bold">{available}</div>
            <div className="text-xs">対応可能</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
