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
import { GroupMultiSelect } from "@/components/shifts/group-multi-select"
import { RoleMultiSelect } from "@/components/shifts/role-multi-select"
import { getTodayJST } from "@/lib/date-utils"

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

function getDefaultYearMonth() {
  const today = getTodayJST()
  return {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  }
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i)

export function ShiftExportSection({ groups, roles }: Props) {
  const defaultYM = getDefaultYearMonth()
  const [year, setYear] = useState(defaultYM.year)
  const [month, setMonth] = useState(defaultYM.month)
  const [groupIds, setGroupIds] = useState<number[]>([])
  const [groupUnassigned, setGroupUnassigned] = useState(false)
  const [roleIds, setRoleIds] = useState<number[]>([])
  const [roleUnassigned, setRoleUnassigned] = useState(false)

  const handleExport = () => {
    const params = new URLSearchParams({
      year: year.toString(),
      month: month.toString(),
    })
    if (groupIds.length > 0) {
      params.set("groupIds", groupIds.join(","))
    }
    if (groupUnassigned) {
      params.set("unassigned", "true")
    }
    if (roleIds.length > 0) {
      params.set("roleIds", roleIds.join(","))
    }
    if (roleUnassigned) {
      params.set("roleUnassigned", "true")
    }
    window.open(`/api/shifts/export?${params}`, "_blank")
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">シフトCSVエクスポート</h3>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">年</label>
          <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">月</label>
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

        <div className="space-y-1.5">
          <label className="text-sm font-medium">グループ</label>
          <GroupMultiSelect
            groups={groups}
            selectedIds={groupIds}
            unassigned={groupUnassigned}
            onChange={(ids, ua) => {
              setGroupIds(ids)
              setGroupUnassigned(ua)
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">ロール</label>
          <RoleMultiSelect
            roles={roles}
            selectedIds={roleIds}
            unassigned={roleUnassigned}
            onChange={(ids, ua) => {
              setRoleIds(ids)
              setRoleUnassigned(ua)
            }}
          />
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
