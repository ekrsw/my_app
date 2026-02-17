"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useQueryParams } from "@/hooks/use-query-params"
import { useDebounce } from "@/hooks/use-debounce"
import { formatMonth } from "@/lib/date-utils"
import { useState, useEffect } from "react"

type Group = { id: number; name: string }

type ShiftFiltersProps = {
  groups: Group[]
  year: number
  month: number
}

export function ShiftFilters({ groups, year, month }: ShiftFiltersProps) {
  const { setParams, getParam } = useQueryParams()
  const [search, setSearch] = useState(getParam("search"))
  const debouncedSearch = useDebounce(search)
  const currentDate = new Date(year, month - 1)

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

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[120px] text-center font-medium">
          {formatMonth(currentDate)}
        </span>
        <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Select
        value={getParam("groupId", "0")}
        onValueChange={(v) => setParams({ groupId: v === "0" ? null : v })}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="グループ" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0">すべてのグループ</SelectItem>
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
