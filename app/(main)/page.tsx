import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { TodayOverviewClient } from "@/components/dashboard/today-overview-client"
import { TodayDuties } from "@/components/dashboard/today-duties"
import { TodayAttendance } from "@/components/dashboard/today-attendance"
import {
  getTodayOverview,
  getDashboardFilterOptions,
  getTodayShiftChangeHistory,
} from "@/lib/db/dashboard"
import { getTodayDutyAssignments } from "@/lib/db/duty-assignments"
import { getFunctionRoles } from "@/lib/db/roles"
import type { DashboardOverviewFilter } from "@/types"

function parseIds(value: string | string[] | undefined): number[] {
  const str = Array.isArray(value) ? value[0] : value
  if (!str) return []
  return str.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
}

function parseStrings(value: string | string[] | undefined): string[] {
  const str = Array.isArray(value) ? value[0] : value
  if (!str) return []
  return str.split(",").filter(Boolean)
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const groupIds = parseIds(params.groupIds)
  const unassigned = params.unassigned === "true"
  const employeeIds = parseStrings(params.employeeIds)
  const shiftCodes = parseStrings(params.shiftCodes)
  const supervisorRoleNames = parseStrings(params.supervisorRoleNames)
  const businessRoleNames = parseStrings(params.businessRoleNames)
  const isRemote = params.isRemote === "true" || undefined

  const filter: DashboardOverviewFilter = {
    groupIds,
    unassigned,
    employeeIds,
    shiftCodes,
    supervisorRoleNames,
    businessRoleNames,
    isRemote,
  }

  const [todayShifts, todayDuties, todayChanges, filterOptions, roles] =
    await Promise.all([
      getTodayOverview(filter),
      getTodayDutyAssignments(),
      getTodayShiftChangeHistory(),
      getDashboardFilterOptions(),
      getFunctionRoles(),
    ])

  // ロールタイプからカラム名を決定（shift-daily-viewと同じロジック）
  const distinctRoleTypes = (() => {
    const types = [...new Set(roles.map((r) => r.roleType))].sort().reverse()
    return [types[0] ?? "監督", types[1] ?? "業務"] as const
  })()

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        breadcrumbs={[{ label: "ダッシュボード" }]}
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-6">
            <TodayDuties duties={todayDuties} />
            <TodayAttendance changes={todayChanges} />
          </div>
          <TodayOverviewClient
            shifts={todayShifts}
            filterOptions={filterOptions}
            distinctRoleTypes={distinctRoleTypes}
          />
        </div>
      </PageContainer>
    </>
  )
}
