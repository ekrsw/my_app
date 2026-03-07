"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GroupMultiSelect } from "@/components/shifts/group-multi-select"
import { RoleMultiSelect } from "@/components/shifts/role-multi-select"
import { TodayOverviewTable } from "@/components/dashboard/today-overview"
import { useQueryParams } from "@/hooks/use-query-params"
import type { Shift, Employee, Group, EmployeeGroup } from "@/app/generated/prisma/client"

type TodayShift = Shift & {
  employee: (Employee & { groups: (EmployeeGroup & { group: Group })[] }) | null
}

type GroupOption = { id: number; name: string }
type RoleOption = { id: number; roleName: string }

function parseIds(value: string): number[] {
  if (!value) return []
  return value.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
}

type Props = {
  shifts: TodayShift[]
  groups: GroupOption[]
  roles: RoleOption[]
}

export function TodayOverviewClient({ shifts, groups, roles }: Props) {
  const { setParams, getParam } = useQueryParams()

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <CardTitle>本日の出勤者 ({shifts.length}名)</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <GroupMultiSelect
              groups={groups}
              selectedIds={parseIds(getParam("groupIds", ""))}
              unassigned={getParam("unassigned") === "true"}
              onChange={(ids, unassigned) => {
                setParams({
                  groupIds: ids.length > 0 ? ids.join(",") : null,
                  unassigned: unassigned ? "true" : null,
                })
              }}
            />
            <RoleMultiSelect
              roles={roles}
              selectedIds={parseIds(getParam("roleIds", ""))}
              unassigned={getParam("roleUnassigned") === "true"}
              onChange={(ids, roleUnassigned) => {
                setParams({
                  roleIds: ids.length > 0 ? ids.join(",") : null,
                  roleUnassigned: roleUnassigned ? "true" : null,
                })
              }}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {shifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">本日の出勤者はいません</p>
        ) : (
          <TodayOverviewTable shifts={shifts} />
        )}
      </CardContent>
    </Card>
  )
}
