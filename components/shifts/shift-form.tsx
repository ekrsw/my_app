"use client"

import { useState, useEffect, useRef, useTransition } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createShift, updateShift, deleteShift, getLatestShiftNote } from "@/lib/actions/shift-actions"
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
}

type ShiftFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shift?: {
    id: number
    employeeId: string | null
    shiftDate: Date
    shiftCode: string | null
    startTime: Date | null
    endTime: Date | null
    isHoliday: boolean | null
    isRemote: boolean
  }
  employeeId?: string
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

type ShiftFormInnerProps = Omit<ShiftFormProps, "open"> & {
  onClose: () => void
}

function ShiftFormInner({ onClose, shift, employeeId, date, shiftCodes = [] }: ShiftFormInnerProps) {
  const initialCode = shift?.shiftCode ?? ""
  const initialIsCustom = initialCode !== "" && !shiftCodes.some((sc) => sc.code === initialCode)

  const [loading, setLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, startDeleteTransition] = useTransition()
  const [code, setCode] = useState(initialCode)
  const [isCustom, setIsCustom] = useState(initialIsCustom)
  const [isHoliday, setIsHoliday] = useState(shift?.isHoliday ?? false)
  const [isRemote, setIsRemote] = useState(shift?.isRemote ?? false)
  const [note, setNote] = useState("")
  const [skipHistory, setSkipHistory] = useState(false)
  const startTimeRef = useRef<HTMLInputElement>(null)
  const endTimeRef = useRef<HTMLInputElement>(null)

  // 既存シフトコードがプリセットに含まれるか判定
  function getSelectValue(shiftCode: string | null): string {
    if (!shiftCode) return NONE_VALUE
    if (shiftCodes.some((sc) => sc.code === shiftCode)) return shiftCode
    return CUSTOM_VALUE
  }

  // 編集時のみ既存備考を取得
  useEffect(() => {
    if (shift?.id) {
      getLatestShiftNote(shift.id).then((n) => {
        if (n) setNote(n)
      })
    }
  }, [shift?.id])

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
      // isRemote は変更しない
    }
  }

  const isEdit = !!shift

  function handleDelete() {
    startDeleteTransition(async () => {
      if (!shift) return
      const result = await deleteShift(shift.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("シフトを削除しました")
        onClose()
      }
    })
  }

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
        isRemote,
        note: skipHistory ? null : (note || null),
        skipHistory,
      })
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("シフトを更新しました")
        onClose()
      }
    } else {
      const result = await createShift({
        employeeId: employeeId!,
        shiftDate: date!,
        shiftCode: code || null,
        startTime: (form.get("startTime") as string) || null,
        endTime: (form.get("endTime") as string) || null,
        isHoliday,
        isRemote,
      })
      setLoading(false)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("シフトを作成しました")
        onClose()
      }
    }
  }

  const selectValue = getSelectValue(isCustom ? CUSTOM_VALUE : code || null)

  return (
    <>
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
              id="isRemote"
              checked={isRemote}
              onCheckedChange={(v) => setIsRemote(v === true)}
            />
            <Label htmlFor="isRemote">テレワーク</Label>
          </div>
        </div>
        {isEdit && (
          <>
            <div className="space-y-2">
              <Label htmlFor="note">備考</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="変更理由など"
                maxLength={255}
                rows={2}
                disabled={skipHistory}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="skipHistory"
                checked={skipHistory}
                onCheckedChange={(v) => setSkipHistory(v === true)}
              />
              <Label htmlFor="skipHistory" className="text-sm">変更履歴を残さない</Label>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading || isDeleting}>
            {loading ? "保存中..." : "保存"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          {isEdit && (
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={loading || isDeleting}>
                  削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>シフトを削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    このシフトを削除します。この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                    削除する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </>
  )
}

export function ShiftForm({ open, onOpenChange, shift, employeeId, date, shiftCodes = [] }: ShiftFormProps) {
  // ダイアログを開くたびに内部コンポーネントをリマウントするためのキー
  const [dialogKey, setDialogKey] = useState(0)

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      // 開くときにキーを更新してリマウント
      setDialogKey((k) => k + 1)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        {open && (
          <ShiftFormInner
            key={dialogKey}
            onOpenChange={onOpenChange}
            onClose={() => onOpenChange(false)}
            shift={shift}
            employeeId={employeeId}
            date={date}
            shiftCodes={shiftCodes}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
