"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { formatDate, formatTime } from "@/lib/date-utils"
import { getShiftCodeInfo, type ShiftCodeInfo } from "@/lib/constants"
import type { Shift } from "@/app/generated/prisma/client"
import type { LatestShiftHistory } from "@/lib/db/shifts"

type ShiftDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift: Shift
  employeeName: string
  date: string
  shiftCodeMap: Record<string, ShiftCodeInfo>
  hasHistory: boolean
  latestHistory: LatestShiftHistory | null
  isAuthenticated?: boolean
  onEdit: () => void
}

export function ShiftDetailDialog({
  open,
  onOpenChange,
  shift,
  employeeName,
  date,
  shiftCodeMap,
  hasHistory,
  latestHistory,
  isAuthenticated,
  onEdit,
}: ShiftDetailDialogProps) {
  const codeInfo = getShiftCodeInfo(shift.shiftCode, shiftCodeMap)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>シフト詳細</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 従業員名 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">従業員</span>
            <span className="text-sm font-medium">{employeeName}</span>
          </div>

          {/* 日付 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">日付</span>
            <span className="text-sm font-medium">
              {formatDate(date, "yyyy年M月d日(E)")}
            </span>
          </div>

          <Separator />

          {/* シフトコード */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">シフトコード</span>
            {shift.shiftCode ? (
              <Badge className={`${codeInfo.bgColor} ${codeInfo.color} border-0`}>
                {shift.shiftCode}{codeInfo.label !== shift.shiftCode ? ` - ${codeInfo.label}` : ""}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>

          {/* 開始時刻 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">開始時刻</span>
            <span className="text-sm font-medium">
              {formatTime(shift.startTime)}
            </span>
          </div>

          {/* 終了時刻 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">終了時刻</span>
            <span className="text-sm font-medium">
              {formatTime(shift.endTime)}
            </span>
          </div>

          <Separator />

          {/* 休日 */}
          {shift.isHoliday && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">休日</span>
              <Badge variant="secondary">休日</Badge>
            </div>
          )}

          {/* テレワーク */}
          {shift.isRemote && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">テレワーク</span>
              <Badge variant="secondary">テレワーク</Badge>
            </div>
          )}

          {(shift.isHoliday || shift.isRemote) && hasHistory && latestHistory && (
            <Separator />
          )}

          {/* 変更履歴 */}
          {hasHistory && latestHistory && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">変更履歴</span>
                <span className="text-sm font-medium">
                  {latestHistory.shiftCode ?? "-"}{latestHistory.isRemote ? " TW" : ""} → {latestHistory.newShiftCode ?? "-"}{latestHistory.newIsRemote ? " TW" : ""}
                </span>
              </div>
              {latestHistory.note && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">備考</span>
                  <span className="text-sm font-medium">{latestHistory.note}</span>
                </div>
              )}
            </>
          )}
        </div>

        {isAuthenticated && (
          <DialogFooter>
            <Button onClick={onEdit}>
              編集
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
