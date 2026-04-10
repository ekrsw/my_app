"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { ChevronDown, Pencil, Plus, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { COLOR_PALETTE } from "@/lib/constants"
import type { DutyCalendarCell } from "@/types/duties"

type DutyCellDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  duties: DutyCalendarCell[]
  dateStr: string
  employeeId: string
  employeeName: string
  isAuthenticated: boolean
  onEdit: (assignmentId: number) => void
  onDelete: (assignmentId: number) => void
  onAddNew: (dateStr: string, employeeId: string) => void
  editLoadingId: number | null
  deleteLoadingId: number | null
}

export function DutyCellDialog({
  open,
  onOpenChange,
  duties,
  dateStr,
  employeeId,
  employeeName,
  isAuthenticated,
  onEdit,
  onDelete,
  onAddNew,
  editLoadingId,
  deleteLoadingId,
}: DutyCellDialogProps) {
  const formattedDate = (() => {
    const d = new Date(dateStr + "T00:00:00+09:00")
    const dayNames = ["日", "月", "火", "水", "木", "金", "土"]
    return `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]})`
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] max-h-[80vh] overflow-auto p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b bg-muted/30">
          <DialogTitle className="text-base">{employeeName}</DialogTitle>
          <p className="text-xs text-muted-foreground">{formattedDate}</p>
        </DialogHeader>

        {/* 業務リスト */}
        <div className="p-3 space-y-1">
          {duties.length > 0 ? (
            duties.map((duty) => (
              <DutyItem
                key={duty.id}
                duty={duty}
                isAuthenticated={isAuthenticated}
                onEdit={() => {
                  onOpenChange(false)
                  onEdit(duty.id)
                }}
                onDelete={() => onDelete(duty.id)}
                isEditLoading={editLoadingId === duty.id}
                isDeleteLoading={deleteLoadingId === duty.id}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              割当なし
            </p>
          )}
        </div>

        {/* 新規追加ボタン */}
        {isAuthenticated && (
          <div className="px-3 pb-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                onOpenChange(false)
                onAddNew(dateStr, employeeId)
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              新規追加
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DutyItem({
  duty,
  isAuthenticated,
  onEdit,
  onDelete,
  isEditLoading,
  isDeleteLoading,
}: {
  duty: DutyCalendarCell
  isAuthenticated: boolean
  onEdit: () => void
  onDelete: () => void
  isEditLoading: boolean
  isDeleteLoading: boolean
}) {
  const palette = duty.dutyTypeColor
    ? COLOR_PALETTE[duty.dutyTypeColor] ?? COLOR_PALETTE["gray"]
    : COLOR_PALETTE["gray"]

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-accent/50 transition-colors text-sm">
        <span
          className={cn("inline-block h-2.5 w-2.5 rounded-full flex-shrink-0", palette.swatch)}
        />
        <span className="flex-1 truncate">
          {duty.title ? `${duty.dutyTypeName}: ${duty.title}` : duty.dutyTypeName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-7 pr-2 pb-2 space-y-1">
          <div className="text-xs text-muted-foreground">
            {duty.startTime} - {duty.endTime}
          </div>
          {duty.note && (
            <div className="text-xs text-muted-foreground">
              {duty.note}
            </div>
          )}
          <div className="text-xs">
            {duty.reducesCapacity ? (
              <span className="text-orange-600">定員控除あり</span>
            ) : (
              <span className="text-muted-foreground">定員控除なし</span>
            )}
          </div>
          {isAuthenticated && (
            <div className="flex gap-1 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={onEdit}
                disabled={isEditLoading}
              >
                {isEditLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Pencil className="h-3 w-3 mr-1" />
                )}
                編集
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                    disabled={isDeleteLoading}
                  >
                    {isDeleteLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    削除
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>業務割当の削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      「{duty.dutyTypeName}」の割当を削除してもよろしいですか？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete} disabled={isDeleteLoading}>
                      {isDeleteLoading ? "削除中..." : "削除"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
