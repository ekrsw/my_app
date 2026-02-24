"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createShift, updateShift } from "@/lib/actions/shift-actions"
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

type ShiftFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: {
    id: number
    employeeId: number | null
    shiftDate: Date
    shiftCode: string | null
    startTime: Date | null
    endTime: Date | null
    isHoliday: boolean | null
    isPaidLeave: boolean | null
    isRemote: boolean
  }
  employeeId?: number
  date?: string
  shiftCodes?: ActiveShiftCode[]
}

function timeToInput(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

const NONE_VALUE = "__none__"
const CUSTOM_VALUE = "__custom__"

export function ShiftForm({ open, onOpenChange, shift, employeeId, date, shiftCodes = [] }: ShiftFormProps) {
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState(shift?.shiftCode ?? "")
  const [isCustom, setIsCustom] = useState(false)
  const [isHoliday, setIsHoliday] = useState(shift?.isHoliday ?? false)
  const [isPaidLeave, setIsPaidLeave] = useState(shift?.isPaidLeave ?? false)
  const [isRemote, setIsRemote] = useState(shift?.isRemote ?? false)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const endTimeRef = useRef<HTMLInputElement>(null)

  // 既存シフトコードがプリセットに含まれるか判定
  function getSelectValue(shiftCode: string | null): string {
    if (!shiftCode) return NONE_VALUE
    if (shiftCodes.some((sc) => sc.code === shiftCode)) return shiftCode
    return CUSTOM_VALUE
  }

  useEffect(() => {
    if (open) {
      const currentCode = shift?.shiftCode ?? ""
      setCode(currentCode)
      setIsCustom(currentCode !== "" && !shiftCodes.some((sc) => sc.code === currentCode))
      setIsHoliday(shift?.isHoliday ?? false)
      setIsPaidLeave(shift?.isPaidLeave ?? false)
      setIsRemote(shift?.isRemote ?? false)
      if (startTimeRef.current) {
        startTimeRef.current.value = timeToInput(shift?.startTime ?? null)
      }
      if (endTimeRef.current) {
        endTimeRef.current.value = timeToInput(shift?.endTime ?? null)
      }
    }
  }, [open, shift, shiftCodes])

  function handleSelectChange(value: string) {
    if (value === NONE_VALUE) {
      setCode("")
      setIsCustom(false)
      return
    }
    if (value === CUSTOM_VALUE) {
      setCode("")
      setIsCustom(true)
      return
    }
    // プリセット選択 → デフォルト値を自動入力
    setCode(value)
    setIsCustom(false)
    const preset = shiftCodes.find((sc) => sc.code === value)
    if (preset) {
      if (startTimeRef.current) {
        startTimeRef.current.value = timeToInput(preset.defaultStartTime)
      }
      if (endTimeRef.current) {
        endTimeRef.current.value = timeToInput(preset.defaultEndTime)
      }
      setIsHoliday(preset.defaultIsHoliday)
      setIsPaidLeave(preset.defaultIsPaidLeave)
      // isRemote は変更しない
    }
  }

  const isEdit = !!shift

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)

    if (isEdit) {
      const result = await updateShift(shift.id, {
        shiftCode: code || null,
        startTime: (form.get("startTime") as string) || null,
        endTime: (form.get("endTime") as string) || null,
        isHoliday,
        isPaidLeave,
        isRemote,
      })
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("シフトを更新しました")
        onOpenChange(false)
      }
    } else {
      const result = await createShift({
        employeeId: employeeId!,
        shiftDate: date!,
        shiftCode: code || null,
        startTime: (form.get("startTime") as string) || null,
        endTime: (form.get("endTime") as string) || null,
        isHoliday,
        isPaidLeave,
        isRemote,
      })
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("シフトを作成しました")
        onOpenChange(false)
      }
    }
  }

  const selectValue = getSelectValue(isCustom ? CUSTOM_VALUE : code || null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "シフト編集" : "シフト作成"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>シフトコード</Label>
            <Select value={selectValue} onValueChange={handleSelectChange}>
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
            {isCustom && (
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="カスタムコードを入力"
                maxLength={20}
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">開始時刻</Label>
              <Input
                ref={startTimeRef}
                id="startTime"
                name="startTime"
                type="time"
                defaultValue={timeToInput(shift?.startTime ?? null)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">終了時刻</Label>
              <Input
                ref={endTimeRef}
                id="endTime"
                name="endTime"
                type="time"
                defaultValue={timeToInput(shift?.endTime ?? null)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isHoliday"
                checked={isHoliday}
                onCheckedChange={(v) => setIsHoliday(v === true)}
              />
              <Label htmlFor="isHoliday">休日</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPaidLeave"
                checked={isPaidLeave}
                onCheckedChange={(v) => setIsPaidLeave(v === true)}
              />
              <Label htmlFor="isPaidLeave">有給休暇</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isRemote"
                checked={isRemote}
                onCheckedChange={(v) => setIsRemote(v === true)}
              />
              <Label htmlFor="isRemote">テレワーク</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
