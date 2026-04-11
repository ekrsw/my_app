"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { DutyAssignmentDetailDialog } from "@/components/duty-assignments/duty-assignment-detail-dialog"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn, formatTime } from "@/lib/utils"
import { Plus } from "lucide-react"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type Props = {
  duties: DutyAssignmentWithDetails[]
  employees: { id: string; name: string }[]
  dutyTypes: { id: number; name: string; defaultReducesCapacity: boolean; defaultStartTime: string | null; defaultEndTime: string | null; defaultNote: string | null; defaultTitle: string | null }[]
  isAuthenticated: boolean
  todayDateString: string
}

export function TodayDuties({ duties, employees, dutyTypes, isAuthenticated, todayDateString }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<DutyAssignmentWithDetails | null>(null)

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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>本日の業務 ({duties.length}件)</CardTitle>
            {isAuthenticated && (
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {duties.length === 0 ? (
            <p className="text-sm text-muted-foreground">本日の業務はありません</p>
          ) : (
            <div className="grid grid-cols-[auto_auto_1fr] gap-x-3 gap-y-1 text-sm">
              {Object.values(grouped).map(({ dutyType, assignments }, groupIdx) => {
                const colorKey = dutyType.color
                const palette = colorKey ? COLOR_PALETTE[colorKey] : null
                return (
                  <React.Fragment key={dutyType.id}>
                    <div className={cn("col-span-3 flex items-center gap-2", groupIdx > 0 && "mt-3")}>
                      {palette && (
                        <span className={cn("inline-block h-3 w-3 rounded-full", palette.swatch)} />
                      )}
                      <span className="font-medium">{dutyType.name}</span>
                    </div>
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="col-span-3 grid grid-cols-subgrid items-center cursor-pointer rounded hover:bg-accent"
                        onClick={() => setDetailTarget(assignment)}
                      >
                        <span className="pl-5 py-0.5">
                          {assignment.employee.name}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {assignment.employee.groups.length > 0
                            ? assignment.employee.groups.map((eg) => eg.group.abbreviatedName || eg.group.name).join(", ")
                            : "-"}
                        </span>
                        <span className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className={cn(
                            "text-xs shrink-0",
                            palette ? palette.text : ""
                          )}>
                            {formatTime(assignment.startTime)}〜{formatTime(assignment.endTime)}
                          </Badge>
                          {assignment.title && (
                            <span className="text-xs text-muted-foreground truncate">
                              {assignment.title}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新規作成フォーム */}
      <DutyAssignmentForm
        employees={employees}
        dutyTypes={dutyTypes}
        defaultDate={todayDateString}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* 詳細ダイアログ（共通コンポーネント） */}
      <DutyAssignmentDetailDialog
        open={!!detailTarget}
        onOpenChange={(v) => !v && setDetailTarget(null)}
        duty={detailTarget}
        isAuthenticated={isAuthenticated}
        employees={employees}
        dutyTypes={dutyTypes}
      />
    </>
  )
}
