"use client"

import { Input } from "@/components/ui/input"
import { useQueryParams } from "@/hooks/use-query-params"
import { useDebounce } from "@/hooks/use-debounce"
import { useState, useEffect } from "react"

export function ShiftHistoryFilters() {
  const { getParam, setParams } = useQueryParams()
  const [employeeName, setEmployeeName] = useState(getParam("historyEmployee"))
  const debouncedName = useDebounce(employeeName)

  useEffect(() => {
    setParams({ historyEmployee: debouncedName || null, page: 1 })
  }, [debouncedName]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <Input
        type="date"
        value={getParam("historyDate")}
        onChange={(e) => setParams({ historyDate: e.target.value || null, page: 1 })}
        className="w-48"
      />
      <Input
        placeholder="従業員名で検索..."
        value={employeeName}
        onChange={(e) => setEmployeeName(e.target.value)}
        className="w-64"
      />
    </div>
  )
}
