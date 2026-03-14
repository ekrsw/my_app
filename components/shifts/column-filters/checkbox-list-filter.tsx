"use client"

import { ReactNode } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

type CheckboxOption = {
  value: string
  label: ReactNode
}

type SpecialOption = {
  value: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

type CheckboxListFilterProps = {
  options: CheckboxOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  specialOption?: SpecialOption
}

export function CheckboxListFilter({
  options,
  selectedValues,
  onChange,
  specialOption,
}: CheckboxListFilterProps) {
  const toggleValue = (value: string) => {
    const next = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value]
    onChange(next)
  }

  const hasSelection = selectedValues.length > 0 || specialOption?.checked

  const clearAll = () => {
    onChange([])
    specialOption?.onChange(false)
  }

  return (
    <div className="flex flex-col gap-1">
      {specialOption && (
        <>
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
            <Checkbox
              checked={specialOption.checked}
              onCheckedChange={(checked) =>
                specialOption.onChange(checked === true)
              }
            />
            <span className="text-sm">{specialOption.label}</span>
            <Badge variant="outline" className="ml-auto text-xs">
              特殊
            </Badge>
          </label>
          <div className="border-t my-1" />
        </>
      )}
      <ScrollArea className="max-h-48">
        <div className="flex flex-col gap-0.5">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={selectedValues.includes(opt.value)}
                onCheckedChange={() => toggleValue(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
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
    </div>
  )
}
