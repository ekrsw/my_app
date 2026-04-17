"use client"

import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ShiftImportSection } from "@/components/data/shift-import-section"
import { ShiftExportSection } from "@/components/data/shift-export-section"
import { EmployeeImportSection } from "@/components/data/employee-import-section"
import { EmployeeExportSection } from "@/components/data/employee-export-section"

type Group = {
  id: number
  name: string
  _count: { employeeGroups: number }
}

type Role = {
  id: number
  roleName: string
  roleType: string
  _count: { employeeRoles: number }
}

type Props = {
  groups: Group[]
  roles: Role[]
}

type Mode = "import" | "export"
type DataType = "shifts" | "employees"

export function DataPageClient({ groups, roles }: Props) {
  const [mode, setMode] = useState<Mode>("export")
  const [dataType, setDataType] = useState<DataType>("shifts")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          className="flex items-center gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="import" id="mode-import" />
            <Label htmlFor="mode-import">インポート</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="export" id="mode-export" />
            <Label htmlFor="mode-export">エクスポート</Label>
          </div>
        </RadioGroup>

        <Select value={dataType} onValueChange={(v) => setDataType(v as DataType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shifts">シフト管理</SelectItem>
            <SelectItem value="employees">従業員</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg p-6">
        {mode === "import" && dataType === "shifts" && (
          <ShiftImportSection />
        )}
        {mode === "export" && dataType === "shifts" && (
          <ShiftExportSection groups={groups} roles={roles} />
        )}
        {mode === "import" && dataType === "employees" && (
          <EmployeeImportSection />
        )}
        {mode === "export" && dataType === "employees" && (
          <EmployeeExportSection groups={groups} />
        )}
      </div>
    </div>
  )
}
