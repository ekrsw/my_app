"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ChevronsUpDown } from "lucide-react"

type DutyType = { id: number; code: string; name: string }

type DutyTypeMultiSelectProps = {
  dutyTypes: DutyType[]
  selectedIds: number[]
  unassigned: boolean
  onChange: (selectedIds: number[], unassigned: boolean) => void
}

export function DutyTypeMultiSelect({
  dutyTypes,
  selectedIds,
  unassigned,
  onChange,
}: DutyTypeMultiSelectProps) {
  const hasSelection = selectedIds.length > 0 || unassigned

  const toggleDutyType = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((v) => v !== id)
      : [...selectedIds, id]
    onChange(next, unassigned)
  }

  const toggleUnassigned = () => {
    onChange(selectedIds, !unassigned)
  }

  const clearAll = () => {
    onChange([], false)
  }

  const label = () => {
    if (!hasSelection) return "すべての業務種別"
    const parts: string[] = []
    if (unassigned) parts.push("業務なし")
    if (selectedIds.length <= 2) {
      parts.push(
        ...selectedIds.map(
          (id) => dutyTypes.find((dt) => dt.id === id)?.name ?? ""
        )
      )
    } else {
      parts.push(`${selectedIds.length}種別`)
    }
    return parts.filter(Boolean).join(", ")
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
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
            <Checkbox
              checked={unassigned}
              onCheckedChange={toggleUnassigned}
            />
            <span className="text-sm">業務なし</span>
            <Badge variant="outline" className="ml-auto text-xs">
              特殊
            </Badge>
          </label>
          <div className="border-t my-1" />
          {dutyTypes.map((dt) => (
            <label
              key={dt.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={selectedIds.includes(dt.id)}
                onCheckedChange={() => toggleDutyType(dt.id)}
              />
              <span className="text-sm">{dt.name}</span>
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
