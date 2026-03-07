"use client"

import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { GroupMultiSelect } from "@/components/shifts/group-multi-select"
import { RoleMultiSelect } from "@/components/shifts/role-multi-select"
import { useQueryParams } from "@/hooks/use-query-params"
import { useDebounce } from "@/hooks/use-debounce"
import { useState, useEffect } from "react"

type Group = { id: number; name: string }
type Role = { id: number; roleName: string }

export function EmployeeFilters({
  groups,
  roles,
}: {
  groups: Group[]
  roles: Role[]
}) {
  const { getParam, setParams } = useQueryParams()
  const [search, setSearch] = useState(getParam("search"))
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    setParams({ search: debouncedSearch || null, page: 1 })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // グループフィルター状態をURLパラメータから復元
  const groupIdsParam = getParam("groupIds")
  const selectedGroupIds = groupIdsParam
    ? groupIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : []
  const groupUnassigned = getParam("unassigned") === "true"

  // 役割フィルター状態をURLパラメータから復元
  const roleIdsParam = getParam("roleIds")
  const selectedRoleIds = roleIdsParam
    ? roleIdsParam.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : []
  const roleUnassigned = getParam("roleUnassigned") === "true"

  const handleGroupChange = (ids: number[], unassigned: boolean) => {
    setParams({
      groupIds: ids.length > 0 ? ids.join(",") : null,
      unassigned: unassigned ? "true" : null,
      groupId: null, // 旧パラメータをクリア
      page: 1,
    })
  }

  const handleRoleChange = (ids: number[], unassigned: boolean) => {
    setParams({
      roleIds: ids.length > 0 ? ids.join(",") : null,
      roleUnassigned: unassigned ? "true" : null,
      page: 1,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Input
        placeholder="名前で検索..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />
      <GroupMultiSelect
        groups={groups}
        selectedIds={selectedGroupIds}
        unassigned={groupUnassigned}
        onChange={handleGroupChange}
      />
      <RoleMultiSelect
        roles={roles}
        selectedIds={selectedRoleIds}
        unassigned={roleUnassigned}
        onChange={handleRoleChange}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id="activeOnly"
          checked={getParam("activeOnly") === "true"}
          onCheckedChange={(checked) =>
            setParams({ activeOnly: checked ? "true" : null, page: 1 })
          }
        />
        <Label htmlFor="activeOnly" className="text-sm">
          在籍者のみ
        </Label>
      </div>
    </div>
  )
}
