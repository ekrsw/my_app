"use client"

import { ReactNode, useState, useMemo, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

type CheckboxOption = {
  value: string
  label: ReactNode
  /** 検索用テキスト（labelがReactNodeの場合に使用） */
  searchText?: string
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
  onConfirm: (values: string[]) => void
  onClear: () => void
  popoverOpen: boolean
  specialOption?: SpecialOption
  searchPlaceholder?: string
}

export function CheckboxListFilter({
  options,
  selectedValues,
  onConfirm,
  onClear,
  popoverOpen,
  specialOption,
  searchPlaceholder = "検索...",
}: CheckboxListFilterProps) {
  const [localValues, setLocalValues] = useState<string[]>(selectedValues)
  const [localSpecialChecked, setLocalSpecialChecked] = useState(specialOption?.checked ?? false)
  const [searchText, setSearchText] = useState("")

  // ポップオーバー開時に外部stateを同期
  useEffect(() => {
    if (popoverOpen) {
      setLocalValues(selectedValues)
      setLocalSpecialChecked(specialOption?.checked ?? false)
      setSearchText("")
    }
  }, [popoverOpen, selectedValues, specialOption?.checked])

  const filteredOptions = useMemo(() => {
    if (!searchText) return options
    const lower = searchText.toLowerCase()
    return options.filter((opt) => {
      const text = opt.searchText ?? (typeof opt.label === "string" ? opt.label : "")
      return text.toLowerCase().includes(lower)
    })
  }, [options, searchText])

  const toggleValue = (value: string) => {
    setLocalValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  const handleConfirm = () => {
    onConfirm(localValues)
    if (specialOption) {
      specialOption.onChange(localSpecialChecked)
    }
  }

  const handleClear = () => {
    onClear()
    if (specialOption) {
      specialOption.onChange(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 pl-7"
        />
      </div>
      {specialOption && (
        <>
          <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
            <Checkbox
              checked={localSpecialChecked}
              onCheckedChange={(checked) => setLocalSpecialChecked(checked === true)}
            />
            <span className="text-sm">{specialOption.label}</span>
            <Badge variant="outline" className="ml-auto text-xs">
              特殊
            </Badge>
          </label>
          <div className="border-t" />
        </>
      )}
      <div className="max-h-48 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {filteredOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={localValues.includes(opt.value)}
                onCheckedChange={() => toggleValue(opt.value)}
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
          {filteredOptions.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-1.5">
              該当なし
            </p>
          )}
        </div>
      </div>
      <div className="border-t pt-2 flex justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={handleClear}
        >
          クリア
        </Button>
        <Button
          size="sm"
          className="text-xs"
          onClick={handleConfirm}
        >
          OK
        </Button>
      </div>
    </div>
  )
}
