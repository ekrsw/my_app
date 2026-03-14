"use client"

import { Checkbox } from "@/components/ui/checkbox"

type ToggleFilterProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}

export function ToggleFilter({
  checked,
  onChange,
  label,
}: ToggleFilterProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onChange(val === true)}
      />
      <span className="text-sm">{label}</span>
    </label>
  )
}
