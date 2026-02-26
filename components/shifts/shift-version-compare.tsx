"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ShiftBadge } from "./shift-badge"
import { formatDate, formatTime } from "@/lib/date-utils"
import { restoreShiftVersion } from "@/lib/actions/shift-actions"
import { toast } from "sonner"
import { ArrowRight, RotateCcw } from "lucide-react"
import type { ShiftChangeHistory } from "@/app/generated/prisma/client"

type ShiftVersionCompareProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftId: number
  employeeName: string
}

export function ShiftVersionCompare({
  open,
  onOpenChange,
  shiftId,
  employeeName,
}: ShiftVersionCompareProps) {
  const [versions, setVersions] = useState<ShiftChangeHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (open && shiftId) {
      setLoading(true)
      fetch(`/api/shifts/versions?shiftId=${shiftId}`)
        .then((r) => r.json())
        .then((data) => setVersions(data))
        .catch(() => toast.error("バージョン情報の取得に失敗しました"))
        .finally(() => setLoading(false))
    }
  }, [open, shiftId])

  async function handleRestore(version: number) {
    setRestoring(true)
    const result = await restoreShiftVersion(shiftId, version)
    setRestoring(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`バージョン${version}に復元しました`)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>バージョン履歴 - {employeeName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-4">読み込み中...</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            変更履歴がありません
          </p>
        ) : (
          <div className="space-y-3">
            {versions.map((v) => (
              <div
                key={v.id}
                className="rounded-md border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{v.version}</Badge>
                    <Badge
                      variant={
                        v.changeType === "DELETE" ? "destructive" : "secondary"
                      }
                    >
                      {v.changeType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(v.changedAt, "yyyy/MM/dd HH:mm")}
                    </span>
                  </div>
                  {v.changeType !== "DELETE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(v.version)}
                      disabled={restoring}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      復元
                    </Button>
                  )}
                </div>

                {v.changeType === "DELETE" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">削除されたシフト</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">日付: </span>
                        {formatDate(v.shiftDate)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">コード: </span>
                        <ShiftBadge code={v.shiftCode} />
                      </div>
                      <div>
                        <span className="text-muted-foreground">開始: </span>
                        {v.startTime ? formatTime(v.startTime) : "-"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">終了: </span>
                        {v.endTime ? formatTime(v.endTime) : "-"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">日付: </span>
                        {formatDate(v.shiftDate)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">コード: </span>
                        <ShiftBadge code={v.shiftCode} />
                        {v.newShiftCode !== null && v.shiftCode !== v.newShiftCode && (
                          <>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <ShiftBadge code={v.newShiftCode} />
                          </>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">開始: </span>
                        {v.startTime ? formatTime(v.startTime) : "-"}
                        {v.newStartTime !== null && v.startTime?.toString() !== v.newStartTime?.toString() && (
                          <span className="text-muted-foreground">
                            {" "}<ArrowRight className="inline h-3 w-3" />{" "}
                            {v.newStartTime ? formatTime(v.newStartTime) : "-"}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">終了: </span>
                        {v.endTime ? formatTime(v.endTime) : "-"}
                        {v.newEndTime !== null && v.endTime?.toString() !== v.newEndTime?.toString() && (
                          <span className="text-muted-foreground">
                            {" "}<ArrowRight className="inline h-3 w-3" />{" "}
                            {v.newEndTime ? formatTime(v.newEndTime) : "-"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      {v.isHoliday && <span>休日</span>}
                      {v.isPaidLeave && <span>有給</span>}
                      {v.isRemote && <span>テレワーク</span>}
                      {v.note && <span>備考: {v.note}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
