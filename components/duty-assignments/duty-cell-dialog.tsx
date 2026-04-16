"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Plus, Loader2 } from "lucide-react"
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
  onAddNew: (dateStr: string, employeeId: string) => void
  onViewDetail: (dutyId: number) => void
  detailLoadingId: number | null
}

export function DutyCellDialog({
  open,
  onOpenChange,
  duties,
  dateStr,
  employeeId,
  employeeName,
  isAuthenticated,
  onAddNew,
  onViewDetail,
  detailLoadingId,
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
                onClick={() => onViewDetail(duty.id)}
                isLoading={detailLoadingId === duty.id}
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
  onClick,
  isLoading,
}: {
  duty: DutyCalendarCell
  onClick: () => void
  isLoading: boolean
}) {
  const palette = duty.dutyTypeColor
    ? COLOR_PALETTE[duty.dutyTypeColor] ?? COLOR_PALETTE["gray"]
    : COLOR_PALETTE["gray"]

  return (
    <button
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-accent/50 transition-colors text-sm"
      onClick={onClick}
      disabled={isLoading}
    >
      <span
        className={cn("inline-block h-2.5 w-2.5 rounded-full flex-shrink-0", palette.swatch)}
      />
      <span className="flex-1 truncate">
        {duty.title ? `${duty.dutyTypeName}: ${duty.title}` : duty.dutyTypeName}
      </span>
      {isLoading && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0 text-muted-foreground" />}
    </button>
  )
}
