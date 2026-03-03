"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { useQueryParams } from "@/hooks/use-query-params"
import { useDebounce } from "@/hooks/use-debounce"
import { formatMonth } from "@/lib/date-utils"
import { useState, useEffect, useRef, useMemo } from "react"

type Group = { id: number; name: string }

type ShiftFiltersProps = {
  groups: Group[]
  year: number
  month: number
}

function parseMonthInput(input: string): { year: number; month: number } | null {
  const trimmed = input.trim()

  // "2026年3月" or "2026年03月"
  const jaMatch = trimmed.match(/^(\d{4})年(\d{1,2})月?$/)
  if (jaMatch) {
    const y = parseInt(jaMatch[1], 10)
    const m = parseInt(jaMatch[2], 10)
    if (m >= 1 && m <= 12) return { year: y, month: m }
  }

  // "2026/3" or "2026-3" or "2026/03" or "2026-03"
  const slashMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})$/)
  if (slashMatch) {
    const y = parseInt(slashMatch[1], 10)
    const m = parseInt(slashMatch[2], 10)
    if (m >= 1 && m <= 12) return { year: y, month: m }
  }

  return null
}

export function ShiftFilters({ groups, year, month }: ShiftFiltersProps) {
  const { setParams, getParam } = useQueryParams()
  const [search, setSearch] = useState(getParam("search"))
  const debouncedSearch = useDebounce(search)
  const currentDate = new Date(year, month - 1)

  const formattedMonth = useMemo(() => formatMonth(currentDate), [year, month]) // eslint-disable-line react-hooks/exhaustive-deps
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setParams({ search: debouncedSearch || null })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta)
    setParams({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }

  const navigateToYearMonth = (y: number, m: number) => {
    setParams({ year: y, month: m })
  }

  const handleMonthInputCommit = () => {
    if (editingValue !== null) {
      const parsed = parseMonthInput(editingValue)
      if (parsed) {
        navigateToYearMonth(parsed.year, parsed.month)
      }
      setEditingValue(null)
    }
  }

  const handleMonthInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleMonthInputCommit()
      inputRef.current?.blur()
    }
  }

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          ref={inputRef}
          value={editingValue ?? formattedMonth}
          onFocus={() => setEditingValue(formattedMonth)}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={handleMonthInputCommit}
          onKeyDown={handleMonthInputKeyDown}
          className="w-[130px] text-center font-medium"
        />
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon">
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex items-center gap-2">
              <Select
                value={year.toString()}
                onValueChange={(v) => {
                  navigateToYearMonth(parseInt(v, 10), month)
                  setCalendarOpen(false)
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={month.toString()}
                onValueChange={(v) => {
                  navigateToYearMonth(year, parseInt(v, 10))
                  setCalendarOpen(false)
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m}月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Select
        value={
          getParam("unassigned") === "true"
            ? "unassigned"
            : getParam("groupId", "0")
        }
        onValueChange={(v) => {
          if (v === "unassigned") {
            setParams({ groupId: null, unassigned: "true" })
          } else {
            setParams({ groupId: v === "0" ? null : v, unassigned: null })
          }
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="グループ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">すべてのグループ</SelectItem>
          <SelectItem value="unassigned">未所属</SelectItem>
          {groups.map((g) => (
            <SelectItem key={g.id} value={g.id.toString()}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="従業員検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-48"
      />
    </div>
  )
}
