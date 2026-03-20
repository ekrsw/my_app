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

type ViewModeSelectProps = {
  value: "monthly" | "daily"
}

export function ViewModeSelect({ value }: ViewModeSelectProps) {
  const { setParams } = useQueryParams()

  const handleChange = (newValue: string) => {
    if (newValue === "daily") {
      setParams({
        view: "daily",
        dailyDate: toDateString(getTodayJST()),
      })
    } else {
      // 月次に戻す: daily固有パラメータをクリア
      setParams({
        view: null,
        dailyDate: null,
        dailyPage: null,
        shiftCodes: null,
        startTimeFrom: null,
        endTimeTo: null,
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
