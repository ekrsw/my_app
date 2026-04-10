"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn, formatTime } from "@/lib/utils"
import { Plus } from "lucide-react"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type Props = {
  duties: DutyAssignmentWithDetails[]
  employees: { id: string; name: string }[]
  dutyTypes: { id: number; name: string; defaultReducesCapacity: boolean; defaultStartTime: string | null; defaultEndTime: string | null; defaultNote: string | null }[]
  isAuthenticated: boolean
  todayDateString: string
}

export function TodayDuties({ duties, employees, dutyTypes, isAuthenticated, todayDateString }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<DutyAssignmentWithDetails | null>(null)
  const [editTarget, setEditTarget] = useState<DutyAssignmentWithDetails | null>(null)

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
                            ? assignment.employee.groups.map((eg) => eg.group.name).join(", ")
                            : "-"}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            palette ? palette.text : ""
                          )}>
                            {formatTime(assignment.startTime)}〜{formatTime(assignment.endTime)}
                          </Badge>
                          {assignment.note && (
                            <span className="text-xs text-muted-foreground truncate">
                              {assignment.note}
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

      {/* 詳細ダイアログ */}
      <Dialog open={!!detailTarget} onOpenChange={(v) => !v && setDetailTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>業務割当の詳細</DialogTitle>
          </DialogHeader>
          {detailTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">業務種別</span>
                <span>{detailTarget.dutyType.name}</span>
                <span className="text-muted-foreground">従業員</span>
                <span>{detailTarget.employee.name}</span>
                <span className="text-muted-foreground">時間帯</span>
                <span>{formatTime(detailTarget.startTime)}〜{formatTime(detailTarget.endTime)}</span>
                <span className="text-muted-foreground">控除</span>
                <span>{detailTarget.reducesCapacity ? "対応可能人員から控除" : "控除しない"}</span>
                {detailTarget.note && (
                  <>
                    <span className="text-muted-foreground">備考</span>
                    <span className="break-words">{detailTarget.note}</span>
                  </>
                )}
              </div>
              {isAuthenticated && (
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDetailTarget(null)
                      setEditTarget(detailTarget)
                    }}
                  >
                    編集
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 編集フォーム */}
      {editTarget && (
        <DutyAssignmentForm
          employees={employees}
          dutyTypes={dutyTypes}
          dutyAssignment={editTarget}
          open={!!editTarget}
          onOpenChange={(v) => !v && setEditTarget(null)}
        />
      )}

    </>
  )
}
