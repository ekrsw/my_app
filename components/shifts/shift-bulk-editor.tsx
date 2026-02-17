"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { bulkUpdateShifts } from "@/lib/actions/shift-actions"
import { toast } from "sonner"

type ShiftBulkEditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedShiftIds: number[]
  onComplete: () => void
}

export function ShiftBulkEditor({
  open,
  onOpenChange,
  selectedShiftIds,
  onComplete,
}: ShiftBulkEditorProps) {
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState("")
  const [applyCode, setApplyCode] = useState(false)
  const [isHoliday, setIsHoliday] = useState(false)
  const [applyHoliday, setApplyHoliday] = useState(false)
  const [isPaidLeave, setIsPaidLeave] = useState(false)
  const [applyPaidLeave, setApplyPaidLeave] = useState(false)
  const [isRemote, setIsRemote] = useState(false)
  const [applyRemote, setApplyRemote] = useState(false)

  async function handleSubmit() {
    if (selectedShiftIds.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { shiftIds: selectedShiftIds }
    if (applyCode) data.shiftCode = code || null
    if (applyHoliday) data.isHoliday = isHoliday
    if (applyPaidLeave) data.isPaidLeave = isPaidLeave
    if (applyRemote) data.isRemote = isRemote

    setLoading(true)
    const result = await bulkUpdateShifts(data)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${selectedShiftIds.length}件のシフトを更新しました`)
      onOpenChange(false)
      onComplete()
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>一括編集</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-5">
          <p className="text-sm text-muted-foreground">
            {selectedShiftIds.length}件のシフトを一括変更します。
            変更する項目にチェックを入れてください。
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="applyCode"
                checked={applyCode}
                onCheckedChange={(v) => setApplyCode(v === true)}
                className="mt-2"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="applyCode">シフトコード</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="例: A, B, H, T"
                  maxLength={20}
                  disabled={!applyCode}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="applyHoliday"
                checked={applyHoliday}
                onCheckedChange={(v) => setApplyHoliday(v === true)}
              />
              <Label htmlFor="applyHoliday" className="flex items-center gap-2">
                休日
                {applyHoliday && (
                  <Checkbox
                    checked={isHoliday}
                    onCheckedChange={(v) => setIsHoliday(v === true)}
                  />
                )}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="applyPaidLeave"
                checked={applyPaidLeave}
                onCheckedChange={(v) => setApplyPaidLeave(v === true)}
              />
              <Label htmlFor="applyPaidLeave" className="flex items-center gap-2">
                有給休暇
                {applyPaidLeave && (
                  <Checkbox
                    checked={isPaidLeave}
                    onCheckedChange={(v) => setIsPaidLeave(v === true)}
                  />
                )}
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="applyRemote"
                checked={applyRemote}
                onCheckedChange={(v) => setApplyRemote(v === true)}
              />
              <Label htmlFor="applyRemote" className="flex items-center gap-2">
                テレワーク
                {applyRemote && (
                  <Checkbox
                    checked={isRemote}
                    onCheckedChange={(v) => setIsRemote(v === true)}
                  />
                )}
              </Label>
            </div>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || selectedShiftIds.length === 0}
          >
            {loading ? "更新中..." : `${selectedShiftIds.length}件を更新`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
