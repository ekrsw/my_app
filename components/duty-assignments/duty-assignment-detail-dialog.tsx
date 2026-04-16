"use client"

import { useState, useCallback } from "react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Trash2 } from "lucide-react"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { formatTime } from "@/lib/utils"
import type { DutyAssignmentWithDetails } from "@/types/duties"

type DutyTypeOption = {
  id: number
  name: string
  defaultReducesCapacity: boolean
  defaultStartTime: string | null
  defaultEndTime: string | null
  defaultNote: string | null
  defaultTitle: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  duty: DutyAssignmentWithDetails | null
  isAuthenticated: boolean
  employees: { id: string; name: string }[]
  dutyTypes: DutyTypeOption[]
  onDelete?: (id: number) => void
  isDeleteLoading?: boolean
}

export function DutyAssignmentDetailDialog({
  open,
  onOpenChange,
  duty,
  isAuthenticated,
  employees,
  dutyTypes,
  onDelete,
  isDeleteLoading,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [dutyForEdit, setDutyForEdit] = useState<DutyAssignmentWithDetails | null>(null)

  const handleOpenChange = useCallback((v: boolean) => {
    if (v) setEditOpen(false)
    onOpenChange(v)
  }, [onOpenChange])

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>業務割当の詳細</DialogTitle>
          </DialogHeader>
          {duty && (
            <div className="space-y-3">
              <div className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
                <span className="text-muted-foreground">業務種別</span>
                <span>{duty.dutyType.name}</span>
                <span className="text-muted-foreground">従業員</span>
                <span>{duty.employee.name}</span>
                <span className="text-muted-foreground">時間帯</span>
                <span>{formatTime(duty.startTime)}〜{formatTime(duty.endTime)}</span>
                <span className="text-muted-foreground">控除</span>
                <span>{duty.reducesCapacity ? "対応可能人員から控除" : "控除しない"}</span>
                {duty.title && (
                  <>
                    <span className="text-muted-foreground">タイトル</span>
                    <span className="break-words">{duty.title}</span>
                  </>
                )}
                {duty.note && (
                  <>
                    <span className="text-muted-foreground">メモ</span>
                    <span className="break-words whitespace-pre-wrap">{duty.note}</span>
                  </>
                )}
              </div>
              {isAuthenticated && (
                <div className="flex justify-end gap-2 pt-2">
                  {onDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={isDeleteLoading}
                        >
                          {isDeleteLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          削除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>業務割当の削除</AlertDialogTitle>
                          <AlertDialogDescription>
                            「{duty.dutyType.name}」の割当を削除してもよろしいですか？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>キャンセル</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(duty.id)}
                            disabled={isDeleteLoading}
                          >
                            {isDeleteLoading ? "削除中..." : "削除"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      setDutyForEdit(duty)
                      onOpenChange(false)
                      setEditOpen(true)
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

      {editOpen && dutyForEdit && (
        <DutyAssignmentForm
          employees={employees}
          dutyTypes={dutyTypes}
          dutyAssignment={dutyForEdit}
          open={editOpen}
          onOpenChange={(v) => {
            if (!v) {
              setEditOpen(false)
              setDutyForEdit(null)
            }
          }}
        />
      )}
    </>
  )
}
