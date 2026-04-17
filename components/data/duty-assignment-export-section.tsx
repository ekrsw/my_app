"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type Props = {
  dutyTypes: Array<{ id: number; name: string }>
}

export function DutyAssignmentExportSection({ dutyTypes }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedDutyTypeId, setSelectedDutyTypeId] = useState<string>("all")

  const handleExport = () => {
    const params = new URLSearchParams()
    params.set("year", year.toString())
    params.set("month", month.toString())
    if (selectedDutyTypeId !== "all") {
      params.set("dutyTypeIds", selectedDutyTypeId)
    }
    window.open(`/api/duty-assignments/export?${params}`, "_blank")
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">業務割当CSVエクスポート</h3>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-sm">年</Label>
          <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-sm">月</Label>
          <Select value={month.toString()} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={m.toString()}>
                  {m}月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-sm">業務種別</Label>
          <Select value={selectedDutyTypeId} onValueChange={setSelectedDutyTypeId}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {dutyTypes.map((dt) => (
                <SelectItem key={dt.id} value={dt.id.toString()}>
                  {dt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Button onClick={handleExport}>
          <Download className="mr-1 h-4 w-4" />
          エクスポート
        </Button>
      </div>
    </div>
  )
}
