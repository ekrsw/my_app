"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { GroupMultiSelect } from "@/components/shifts/group-multi-select"
import { ShiftCodeMultiSelect } from "@/components/shifts/shift-code-multi-select"
import { useQueryParams } from "@/hooks/use-query-params"
import { useDebounce } from "@/hooks/use-debounce"
import { useState, useEffect } from "react"
import { ViewModeSelect } from "@/components/shifts/view-mode-select"
import { ChevronLeft, ChevronRight } from "lucide-react"

type Group = { id: number; name: string }
type ShiftCodeOption = { code: string; color: string | null }

type ShiftDailyFiltersProps = {
  groups: Group[]
  shiftCodes: ShiftCodeOption[]
  dailyDate: string
  groupIds: number[]
  unassigned: boolean
  selectedShiftCodes: string[]
  search: string
  startTimeFrom: string
  endTimeTo: string
}

export function ShiftDailyFilters({
  groups,
  shiftCodes,
  dailyDate,
  groupIds,
  unassigned,
  selectedShiftCodes,
  search,
  startTimeFrom,
  endTimeTo,
}: ShiftDailyFiltersProps) {
  const { setParams } = useQueryParams()
  const [employeeName, setEmployeeName] = useState(search)
  const debouncedName = useDebounce(employeeName)

  useEffect(() => {
    setParams({ search: debouncedName || null, dailyPage: null })
  }, [debouncedName]) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateDate = (delta: number) => {
    const [y, m, d] = dailyDate.split("-").map(Number)
    const date = new Date(y, m - 1, d + delta)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    setParams({ dailyDate: dateStr, dailyPage: null })
  }

  const handleGroupChange = (ids: number[], ua: boolean) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
      unassigned: ua ? "true" : null,
      dailyPage: null,
    })
  }

  const handleShiftCodesChange = (codes: string[]) => {
    setParams({
      shiftCodes: codes.length > 0 ? codes.join(",") : null,
      dailyPage: null,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigateDate(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={dailyDate}
          onChange={(e) =>
            setParams({ dailyDate: e.target.value || null, dailyPage: null })
          }
          className="w-44"
        />
        <ViewModeSelect value="daily" />
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigateDate(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <GroupMultiSelect
        groups={groups}
        selectedIds={groupIds}
        unassigned={unassigned}
        onChange={handleGroupChange}
      />

      <ShiftCodeMultiSelect
        shiftCodes={shiftCodes}
        selectedCodes={selectedShiftCodes}
        onChange={handleShiftCodesChange}
      />

      <Input
        placeholder="従業員名で検索..."
        value={employeeName}
        onChange={(e) => setEmployeeName(e.target.value)}
        className="w-48"
      />

      <Input
        type="time"
        value={startTimeFrom}
        onChange={(e) =>
          setParams({ startTimeFrom: e.target.value || null, dailyPage: null })
        }
        className="w-36"
        title="開始時刻（以降）"
      />

      <Input
        type="time"
        value={endTimeTo}
        onChange={(e) =>
          setParams({ endTimeTo: e.target.value || null, dailyPage: null })
        }
        className="w-36"
        title="終了時刻（以前）"
      />
    </div>
  )
}
