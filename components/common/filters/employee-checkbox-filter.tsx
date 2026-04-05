"use client"

import { useState, useMemo, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

type Employee = {
  id: string
  name: string
}

type EmployeeCheckboxFilterProps = {
  employees: Employee[]
  selectedIds: string[]
  onConfirm: (ids: string[]) => void
  onClear: () => void
  popoverOpen: boolean
}

export function EmployeeCheckboxFilter({
  employees,
  selectedIds,
  onConfirm,
  onClear,
  popoverOpen,
}: EmployeeCheckboxFilterProps) {
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedIds)
  const [searchText, setSearchText] = useState("")

  // ポップオーバー開時に外部stateを同期
  useEffect(() => {
    if (popoverOpen) {
      setLocalSelectedIds(selectedIds)
      setSearchText("")
    }
  }, [popoverOpen, selectedIds])

  const filteredEmployees = useMemo(() => {
    if (!searchText) return employees
    const lower = searchText.toLowerCase()
    return employees.filter((e) => e.name.toLowerCase().includes(lower))
  }, [employees, searchText])

  const toggleEmployee = (id: string) => {
    setLocalSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="従業員名で検索..."
          className="h-8 pl-7"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {filteredEmployees.map((emp) => (
            <label
              key={emp.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={localSelectedIds.includes(emp.id)}
                onCheckedChange={() => toggleEmployee(emp.id)}
              />
              <span className="text-sm">{emp.name}</span>
            </label>
          ))}
          {filteredEmployees.length === 0 && (
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
          onClick={onClear}
        >
          クリア
        </Button>
        <Button
          size="sm"
          className="text-xs"
          onClick={() => onConfirm(localSelectedIds)}
        >
          OK
        </Button>
      </div>
    </div>
  )
}
