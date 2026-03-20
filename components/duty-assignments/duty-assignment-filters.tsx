"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQueryParams } from "@/hooks/use-query-params"

export function DutyAssignmentFilters({ defaultDate }: { defaultDate: string }) {
  const { setParams, getParam } = useQueryParams()

  return (
    <div className="flex items-end gap-4 mb-4">
      <div className="space-y-1">
        <Label htmlFor="filterDate">日付</Label>
        <Input
          id="filterDate"
          type="date"
          value={getParam("date", defaultDate)}
          onChange={(e) => {
            setParams({ date: e.target.value || null })
          }}
        />
      </div>
    </div>
  )
}
