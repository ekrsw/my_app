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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { bulkUpdateShifts } from "@/lib/actions/shift-actions"
import { toast } from "sonner"

type ActiveShiftCode = {
  id: number
  code: string
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  defaultIsPaidLeave: boolean
  isActive: boolean | null
  sortOrder: number
}

type ShiftBulkEditorProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedShiftIds: number[]
  onComplete: () => void
  shiftCodes?: ActiveShiftCode[]
}

function timeToInput(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

const NONE_VALUE = "__none__"
const CUSTOM_VALUE = "__custom__"

export function ShiftBulkEditor({
  open,
  onOpenChange,
  selectedShiftIds,
  onComplete,
  shiftCodes = [],
}: ShiftBulkEditorProps) {
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState("")
  const [isCustom, setIsCustom] = useState(false)
  const [applyCode, setApplyCode] = useState(false)
  const [startTime, setStartTime] = useState("")
  const [applyStartTime, setApplyStartTime] = useState(false)
  const [endTime, setEndTime] = useState("")
  const [applyEndTime, setApplyEndTime] = useState(false)
  const [isHoliday, setIsHoliday] = useState(false)
  const [applyHoliday, setApplyHoliday] = useState(false)
  const [isPaidLeave, setIsPaidLeave] = useState(false)
  const [applyPaidLeave, setApplyPaidLeave] = useState(false)
  const [isRemote, setIsRemote] = useState(false)
  const [applyRemote, setApplyRemote] = useState(false)

  function handleSelectChange(value: string) {
    if (value === NONE_VALUE) {
      setCode("")
      setIsCustom(false)
      setApplyCode(true)
      return
    }
    if (value === CUSTOM_VALUE) {
      setCode("")
      setIsCustom(true)
      setApplyCode(true)
      return
    }
    // プリセット選択 → デフォルト値を自動適用
    setCode(value)
    setIsCustom(false)
    setApplyCode(true)
    const preset = shiftCodes.find((sc) => sc.code === value)
    if (preset) {
      if (preset.defaultStartTime) {
        setStartTime(timeToInput(preset.defaultStartTime))
        setApplyStartTime(true)
      }
      if (preset.defaultEndTime) {
        setEndTime(timeToInput(preset.defaultEndTime))
        setApplyEndTime(true)
      }
      setIsHoliday(preset.defaultIsHoliday)
      setApplyHoliday(true)
      setIsPaidLeave(preset.defaultIsPaidLeave)
      setApplyPaidLeave(true)
      // isRemote は変更しない
    }
  }

  const selectValue = isCustom ? CUSTOM_VALUE : (code || NONE_VALUE)

  async function handleSubmit() {
    if (selectedShiftIds.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { shiftIds: selectedShiftIds }
    if (applyCode) data.shiftCode = code || null
    if (applyStartTime) data.startTime = startTime || null
    if (applyEndTime) data.endTime = endTime || null
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
                <Select
                  value={applyCode ? selectValue : NONE_VALUE}
                  onValueChange={handleSelectChange}
                  disabled={!applyCode}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>（なし）</SelectItem>
                    <SelectSeparator />
                    {shiftCodes.map((sc) => (
                      <SelectItem key={sc.code} value={sc.code}>
                        {sc.code}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={CUSTOM_VALUE}>カスタム入力</SelectItem>
                  </SelectContent>
                </Select>
                {isCustom && applyCode && (
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="カスタムコードを入力"
                    maxLength={20}
                  />
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="applyStartTime"
                checked={applyStartTime}
                onCheckedChange={(v) => setApplyStartTime(v === true)}
                className="mt-2"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="applyStartTime">開始時刻</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={!applyStartTime}
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="applyEndTime"
                checked={applyEndTime}
                onCheckedChange={(v) => setApplyEndTime(v === true)}
                className="mt-2"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="applyEndTime">終了時刻</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={!applyEndTime}
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
