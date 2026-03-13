"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ShiftBadge } from "@/components/shifts/shift-badge"
import { ChevronsUpDown } from "lucide-react"

type ShiftCodeOption = {
  code: string
  color: string | null
}

type ShiftCodeMultiSelectProps = {
  shiftCodes: ShiftCodeOption[]
  selectedCodes: string[]
  onChange: (selectedCodes: string[]) => void
}

export function ShiftCodeMultiSelect({
  shiftCodes,
  selectedCodes,
  onChange,
}: ShiftCodeMultiSelectProps) {
  const hasSelection = selectedCodes.length > 0

  const toggleCode = (code: string) => {
    const next = selectedCodes.includes(code)
      ? selectedCodes.filter((c) => c !== code)
      : [...selectedCodes, code]
    onChange(next)
  }

  const clearAll = () => {
    onChange([])
  }

  const label = () => {
    if (!hasSelection) return "すべてのシフトコード"
    if (selectedCodes.length <= 2) {
      return selectedCodes.join(", ")
    }
    return `${selectedCodes.length}件選択`
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-48 justify-between font-normal">
          <span className="truncate">{label()}</span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
          {shiftCodes.map((sc) => (
            <label
              key={sc.code}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={selectedCodes.includes(sc.code)}
                onCheckedChange={() => toggleCode(sc.code)}
              />
              <ShiftBadge code={sc.code} />
            </label>
          ))}
        </div>
        {hasSelection && (
          <>
            <div className="border-t my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={clearAll}
            >
              選択をクリア
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
