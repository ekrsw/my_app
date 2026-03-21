"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { DutyAssignmentWithDetails } from "@/types/duties"

function formatTime(d: Date | string | null): string {
  if (!d) return "-"
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

type Props = {
  duties: DutyAssignmentWithDetails[]
}

export function TodayDuties({ duties }: Props) {
  // 業務種別ごとにグルーピング
  const grouped = duties.reduce<Record<number, { dutyType: DutyAssignmentWithDetails["dutyType"]; assignments: DutyAssignmentWithDetails[] }>>(
    (acc, duty) => {
      if (!acc[duty.dutyTypeId]) {
        acc[duty.dutyTypeId] = { dutyType: duty.dutyType, assignments: [] }
      }
      acc[duty.dutyTypeId].assignments.push(duty)
      return acc
    },
    {}
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>本日の業務 ({duties.length}件)</CardTitle>
      </CardHeader>
      <CardContent>
        {duties.length === 0 ? (
          <p className="text-sm text-muted-foreground">本日の業務はありません</p>
        ) : (
          <div className="space-y-4">
            {Object.values(grouped).map(({ dutyType, assignments }) => {
              const colorKey = dutyType.color
              const palette = colorKey ? COLOR_PALETTE[colorKey] : null
              return (
                <div key={dutyType.id}>
                  <div className="flex items-center gap-2 mb-2">
                    {palette && (
                      <span className={cn("inline-block h-3 w-3 rounded-full", palette.swatch)} />
                    )}
                    <span className="font-medium text-sm">{dutyType.name}</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="flex items-center gap-2 text-sm">
                        <span>{assignment.employee.name}</span>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          palette ? palette.text : ""
                        )}>
                          {formatTime(assignment.startTime)}〜{formatTime(assignment.endTime)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
