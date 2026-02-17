"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useQueryParams } from "@/hooks/use-query-params"
import { useDebounce } from "@/hooks/use-debounce"
import { useState, useEffect } from "react"

type Group = { id: number; name: string }

export function EmployeeFilters({ groups }: { groups: Group[] }) {
  const { getParam, getNumParam, setParams } = useQueryParams()
  const [search, setSearch] = useState(getParam("search"))
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    setParams({ search: debouncedSearch || null, page: 1 })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Input
        placeholder="名前で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />
      <Select
        value={getNumParam("groupId", 0).toString()}
        onValueChange={(v) => setParams({ groupId: v === "0" ? null : v, page: 1 })}
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
      <div className="flex items-center gap-2">
        <Checkbox
          id="activeOnly"
          checked={getParam("activeOnly") === "true"}
          onCheckedChange={(checked) =>
            setParams({ activeOnly: checked ? "true" : null, page: 1 })
          }
        />
        <Label htmlFor="activeOnly" className="text-sm">
          在籍者のみ
        </Label>
      </div>
    </div>
  )
}
