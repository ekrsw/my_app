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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { deleteDutyAssignment } from "@/lib/actions/duty-assignment-actions"
import { COLOR_PALETTE } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import type { DutyAssignmentWithDetails } from "@/types/duties"

function formatTime(d: Date | string | null): string {
  if (!d) return "-"
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

type Props = {
  duties: DutyAssignmentWithDetails[]
  employees: { id: string; name: string }[]
  dutyTypes: { id: number; code: string; name: string }[]
  isAuthenticated: boolean
  todayDateString: string
}

export function TodayDuties({ duties, employees, dutyTypes, isAuthenticated, todayDateString }: Props) {
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<DutyAssignmentWithDetails | null>(null)
  const [editTarget, setEditTarget] = useState<DutyAssignmentWithDetails | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DutyAssignmentWithDetails | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

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

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const result = await deleteDutyAssignment(deleteTarget.id)
    setDeleteLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("業務割当を削除しました")
      setDeleteTarget(null)
      setDetailTarget(null)
    }
  }

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
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {Object.values(grouped).map(({ dutyType, assignments }, groupIdx) => {
                const colorKey = dutyType.color
                const palette = colorKey ? COLOR_PALETTE[colorKey] : null
                return (
                  <React.Fragment key={dutyType.id}>
                    <div className={cn("col-span-2 flex items-center gap-2", groupIdx > 0 && "mt-3")}>
                      {palette && (
                        <span className={cn("inline-block h-3 w-3 rounded-full", palette.swatch)} />
                      )}
                      <span className="font-medium">{dutyType.name}</span>
                    </div>
                    {assignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className={cn(
                          "col-span-2 grid grid-cols-subgrid items-center",
                          isAuthenticated && "cursor-pointer rounded hover:bg-accent"
                        )}
                        onClick={() => isAuthenticated && setDetailTarget(assignment)}
                      >
                        <span className="pl-5 py-0.5">
                          {assignment.employee.name}
                        </span>
                        <span>
                          <Badge variant="outline" className={cn(
                            "text-xs",
                            palette ? palette.text : ""
                          )}>
                            {formatTime(assignment.startTime)}〜{formatTime(assignment.endTime)}
                          </Badge>
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
              </div>
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
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteTarget(detailTarget)}
                >
                  削除
                </Button>
              </div>
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

      {/* 削除確認ダイアログ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>業務割当の削除</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && `${deleteTarget.dutyType.name}（${deleteTarget.employee.name}）を削除してもよろしいですか？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "削除中..." : "削除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
