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
    if (newValue === "monthly") {
      // 月次に切り替え: daily 固有パラメータをクリア
      setParams({
        view: "monthly",
        dailyDate: null,
        employeeIds: null,
        groupIds: null,
        dutyTypeIds: null,
        reducesCapacity: null,
        sortBy: null,
        sortOrder: null,
      })
    } else {
      // 日次に戻す（デフォルト）: 月次固有パラメータをクリア
      setParams({
        view: null,
        dailyDate: toDateString(getTodayJST()),
        year: null,
        month: null,
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
