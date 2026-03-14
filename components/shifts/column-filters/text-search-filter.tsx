"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/use-debounce"
import { X } from "lucide-react"

type TextSearchFilterProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function TextSearchFilter({
  value,
  onChange,
  placeholder = "検索...",
}: TextSearchFilterProps) {
  const [text, setText] = useState(value)
  const debouncedText = useDebounce(text)

  useEffect(() => {
    onChange(debouncedText)
  }, [debouncedText]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setText(value)
  }, [value])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          className="h-8 pr-8"
        />
        {text && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setText("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
