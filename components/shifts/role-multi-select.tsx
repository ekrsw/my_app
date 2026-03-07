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

type Role = { id: number; roleName: string }

type RoleMultiSelectProps = {
  roles: Role[]
  selectedIds: number[]
  unassigned: boolean
  onChange: (selectedIds: number[], unassigned: boolean) => void
}

export function RoleMultiSelect({
  roles,
  selectedIds,
  unassigned,
  onChange,
}: RoleMultiSelectProps) {
  const hasSelection = selectedIds.length > 0 || unassigned

  const toggleRole = (id: number) => {
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
    if (!hasSelection) return "すべての役割"
    const parts: string[] = []
    if (unassigned) parts.push("未設定")
    if (selectedIds.length <= 2) {
      parts.push(
        ...selectedIds.map(
          (id) => roles.find((r) => r.id === id)?.roleName ?? ""
        )
      )
    } else {
      parts.push(`${selectedIds.length}役割`)
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
            <span className="text-sm">未設定</span>
            <Badge variant="outline" className="ml-auto text-xs">
              特殊
            </Badge>
          </label>
          <div className="border-t my-1" />
          {roles.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={selectedIds.includes(r.id)}
                onCheckedChange={() => toggleRole(r.id)}
              />
              <span className="text-sm">{r.roleName}</span>
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
