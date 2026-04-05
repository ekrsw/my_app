"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useQueryParams } from "@/hooks/use-query-params"
import { toDateString, getTodayJST } from "@/lib/date-utils"

type DutyViewModeSelectProps = {
  value: "monthly" | "daily"
}

export function DutyViewModeSelect({ value }: DutyViewModeSelectProps) {
  const { setParams } = useQueryParams()

  const handleChange = (newValue: string) => {
    if (newValue === "daily") {
      setParams({
        view: "daily",
        dailyDate: toDateString(getTodayJST()),
        // 月次固有パラメータをクリア
        year: null,
        month: null,
      })
    } else {
      // 月次に戻す: daily固有パラメータをクリア
      setParams({
        view: null,
        dailyDate: null,
        employeeIds: null,
        groupIds: null,
        dutyTypeIds: null,
        reducesCapacity: null,
        sortBy: null,
        sortOrder: null,
      })
    }
  }

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="w-[70px] h-9 font-medium">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="monthly">月</SelectItem>
        <SelectItem value="daily">日</SelectItem>
      </SelectContent>
    </Select>
  )
}
