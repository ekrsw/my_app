"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn, formatTime } from "@/lib/utils"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  duties: DutyAssignmentWithDetails[]
  timeLabel: string | null
  onSelectDuty: (dutyId: number) => void
}

export function OtherDutyDialog({ open, onOpenChange, duties, timeLabel, onSelectDuty }: Props) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            他業務{timeLabel ? ` (${timeLabel})` : ""} ({duties.length}件)
          </DialogTitle>
        </DialogHeader>
        {duties.length === 0 ? (
          <p className="text-sm text-muted-foreground">該当する業務はありません</p>
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
                      onClick={() => onSelectDuty(assignment.id)}
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
      </DialogContent>
    </Dialog>
  )
}
