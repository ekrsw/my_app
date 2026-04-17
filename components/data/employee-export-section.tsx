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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type Group = {
  id: number
  name: string
  _count: { employeeGroups: number }
}

type Props = {
  groups: Group[]
}

export function EmployeeExportSection({ groups }: Props) {
  const [groupId, setGroupId] = useState<string>("all")
  const [activeOnly, setActiveOnly] = useState(true)

  const handleExport = () => {
    const params = new URLSearchParams()
    if (groupId !== "all") {
      params.set("groupId", groupId)
    }
    params.set("activeOnly", activeOnly.toString())
    window.open(`/api/employees/export?${params}`, "_blank")
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">従業員CSVエクスポート</h3>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">グループ</label>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id.toString()}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center space-x-2 pb-1">
          <Checkbox
            id="active-only"
            checked={activeOnly}
            onCheckedChange={(checked) => setActiveOnly(checked === true)}
          />
          <Label htmlFor="active-only" className="text-sm font-medium">
            在籍中のみ
          </Label>
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
