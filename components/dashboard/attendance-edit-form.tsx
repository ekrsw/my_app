"use client"

import { useState, useRef, useTransition } from "react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { updateShiftFromAttendance, revertShiftFromAttendance } from "@/lib/actions/shift-actions"
import { toast } from "sonner"

type ActiveShiftCode = {
  id: number
  code: string
  color: string | null
  defaultStartTime: Date | null
  defaultEndTime: Date | null
  defaultIsHoliday: boolean
  isActive: boolean | null
  sortOrder: number
  defaultLunchBreakStart: Date | null
  defaultLunchBreakEnd: Date | null
}

type AttendanceEditFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shiftId: number
  historyId: number
  shift: {
    shiftCode: string | null
    startTime: Date | null
    endTime: Date | null
    isHoliday: boolean | null
    isRemote: boolean
    lunchBreakStart: Date | null
    lunchBreakEnd: Date | null
  }
  employeeName: string
  shiftCodes: ActiveShiftCode[]
}

function timeToInput(d: Date | string | null): string {
  if (!d) return ""
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

const NONE_VALUE = "__none__"
const CUSTOM_VALUE = "__custom__"

function AttendanceEditFormInner({
  onClose,
  shiftId,
  historyId,
  shift,
  employeeName,
  shiftCodes,
}: Omit<AttendanceEditFormProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const initialCode = shift.shiftCode ?? ""
  const initialIsCustom = initialCode !== "" && !shiftCodes.some((sc) => sc.code === initialCode)

  const [loading, setLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [code, setCode] = useState(initialCode)
  const [isCustom, setIsCustom] = useState(initialIsCustom)
  const [isHoliday, setIsHoliday] = useState(shift.isHoliday ?? false)
  const [isRemote, setIsRemote] = useState(shift.isRemote ?? false)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const endTimeRef = useRef<HTMLInputElement>(null)
  const lunchBreakStartRef = useRef<HTMLInputElement>(null)
  const lunchBreakEndRef = useRef<HTMLInputElement>(null)

  function getSelectValue(shiftCode: string | null): string {
    if (!shiftCode) return NONE_VALUE
    if (shiftCodes.some((sc) => sc.code === shiftCode)) return shiftCode
    return CUSTOM_VALUE
  }

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
      if (lunchBreakStartRef.current) {
        lunchBreakStartRef.current.value = timeToInput(preset.defaultLunchBreakStart)
      }
      if (lunchBreakEndRef.current) {
        lunchBreakEndRef.current.value = timeToInput(preset.defaultLunchBreakEnd)
      }
      setIsHoliday(preset.defaultIsHoliday)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setLoading(true)

    const result = await updateShiftFromAttendance(shiftId, historyId, {
      shiftCode: code || null,
      startTime: (form.get("startTime") as string) || null,
      endTime: (form.get("endTime") as string) || null,
      isHoliday,
      isRemote,
      lunchBreakStart: (form.get("lunchBreakStart") as string) || null,
      lunchBreakEnd: (form.get("lunchBreakEnd") as string) || null,
    })
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("勤怠を更新しました")
      onClose()
    }
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await revertShiftFromAttendance(shiftId, historyId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("変更を取り消しました")
        onClose()
      }
    })
  }

  const selectValue = getSelectValue(isCustom ? CUSTOM_VALUE : code || null)

  return (
    <>
      <DialogHeader>
        <DialogTitle>勤怠修正</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>従業員</Label>
          <p className="text-sm font-medium">{employeeName}</p>
        </div>
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
              defaultValue={timeToInput(shift.startTime)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">終了時刻</Label>
            <Input
              ref={endTimeRef}
              id="endTime"
              name="endTime"
              type="time"
              defaultValue={timeToInput(shift.endTime)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lunchBreakStart">昼休憩開始</Label>
            <Input
              ref={lunchBreakStartRef}
              id="lunchBreakStart"
              name="lunchBreakStart"
              type="time"
              defaultValue={timeToInput(shift.lunchBreakStart)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lunchBreakEnd">昼休憩終了</Label>
            <Input
              ref={lunchBreakEndRef}
              id="lunchBreakEnd"
              name="lunchBreakEnd"
              type="time"
              defaultValue={timeToInput(shift.lunchBreakEnd)}
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
              id="isRemote"
              checked={isRemote}
              onCheckedChange={(v) => setIsRemote(v === true)}
            />
            <Label htmlFor="isRemote">テレワーク</Label>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading || isDeleting}>
            {loading ? "保存中..." : "保存"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={loading || isDeleting}>
                削除
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>変更を取り消しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  この変更履歴を削除し、シフトを変更前の状態に戻します。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  取り消す
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </form>
    </>
  )
}

export function AttendanceEditForm({ open, onOpenChange, ...props }: AttendanceEditFormProps) {
  const [dialogKey, setDialogKey] = useState(0)

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      setDialogKey((k) => k + 1)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        {open && (
          <AttendanceEditFormInner
            key={dialogKey}
            onClose={() => onOpenChange(false)}
            {...props}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
