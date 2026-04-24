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
import { ShiftConversionSection } from "@/components/data/shift-conversion-section"
import { EmployeeImportSection } from "@/components/data/employee-import-section"
import { EmployeeExportSection } from "@/components/data/employee-export-section"
import { RoleImportSection } from "@/components/data/role-import-section"
import { RoleExportSection } from "@/components/data/role-export-section"
import { DutyTypeImportSection } from "@/components/data/duty-type-import-section"
import { DutyTypeExportSection } from "@/components/data/duty-type-export-section"
import { DutyAssignmentImportSection } from "@/components/data/duty-assignment-import-section"
import { DutyAssignmentExportSection } from "@/components/data/duty-assignment-export-section"

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

type DutyType = {
  id: number
  name: string
}

type Props = {
  groups: Group[]
  roles: Role[]
  dutyTypes: DutyType[]
}

type Mode = "import" | "export" | "convert"
type DataType = "shifts" | "employees" | "roles" | "dutyTypes" | "dutyAssignments"

export function DataPageClient({ groups, roles, dutyTypes }: Props) {
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
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="convert" id="mode-convert" />
            <Label htmlFor="mode-convert">Excel変換</Label>
          </div>
        </RadioGroup>

        <Select value={dataType} onValueChange={(v) => setDataType(v as DataType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shifts">シフト管理</SelectItem>
            <SelectItem value="employees">従業員</SelectItem>
            <SelectItem value="roles">ロール割当て</SelectItem>
            <SelectItem value="dutyTypes">業務種別マスタ</SelectItem>
            <SelectItem value="dutyAssignments">業務割当</SelectItem>
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
        {mode === "import" && dataType === "roles" && (
          <RoleImportSection />
        )}
        {mode === "export" && dataType === "roles" && (
          <RoleExportSection />
        )}
        {mode === "import" && dataType === "dutyTypes" && (
          <DutyTypeImportSection />
        )}
        {mode === "export" && dataType === "dutyTypes" && (
          <DutyTypeExportSection />
        )}
        {mode === "import" && dataType === "dutyAssignments" && (
          <DutyAssignmentImportSection />
        )}
        {mode === "export" && dataType === "dutyAssignments" && (
          <DutyAssignmentExportSection dutyTypes={dutyTypes} />
        )}
        {mode === "convert" && dataType === "shifts" && (
          <ShiftConversionSection />
        )}
        {mode === "convert" && dataType !== "shifts" && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Excel変換は現在「シフト管理」のみ対応しています
          </div>
        )}
      </div>
    </div>
  )
}
