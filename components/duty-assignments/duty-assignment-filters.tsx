"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useQueryParams } from "@/hooks/use-query-params"

type Props = {
  defaultDate: string
  todayDate: string
}

export function DutyAssignmentFilters({ defaultDate, todayDate }: Props) {
  const { setParams, getParam } = useQueryParams()
  const currentDate = getParam("date", defaultDate)

  return (
    <div className="flex items-end gap-4 mb-4">
      <div className="space-y-1">
        <Label htmlFor="filterDate">日付</Label>
        <Input
          id="filterDate"
          type="date"
          value={currentDate}
          onChange={(e) => {
            setParams({ date: e.target.value || null })
          }}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setParams({ date: todayDate })}
        disabled={currentDate === todayDate}
      >
        今日
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setParams({ date: null })}
        disabled={!currentDate}
      >
        全期間
      </Button>
    </div>
  )
}
