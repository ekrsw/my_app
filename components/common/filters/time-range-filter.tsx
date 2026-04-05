"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type TimeRangeFilterProps = {
  value: string
  onChange: (value: string) => void
  label: string
}

export function TimeRangeFilter({
  value,
  onChange,
  label,
}: TimeRangeFilterProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => onChange("")}
        >
          クリア
        </Button>
      )}
    </div>
  )
}
