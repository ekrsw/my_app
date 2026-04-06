import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { TodayOverviewClient } from "@/components/dashboard/today-overview-client"
import { TodayDuties } from "@/components/dashboard/today-duties"
import { TodayAttendance } from "@/components/dashboard/today-attendance"
import { CapacitySummary } from "@/components/dashboard/capacity-summary"
import {
  getTodayOverview,
  getDashboardFilterOptions,
  getTodayShiftChangeHistory,
  getYesterdayOvernightShifts,
} from "@/lib/db/dashboard"
import { getTodayDutyAssignments, getYesterdayOvernightDutyAssignments } from "@/lib/db/duty-assignments"
import { getActiveDutyTypes } from "@/lib/db/duty-types"
import { getAllEmployees } from "@/lib/db/employees"
import { getFunctionRoles } from "@/lib/db/roles"
import { auth } from "@/auth"
import { getActiveShiftCodes } from "@/lib/db/shift-codes"
import { getShiftIdsWithHistory, getLatestShiftHistoryEntries } from "@/lib/db/shifts"
import { getTodayJST } from "@/lib/date-utils"
import { format } from "date-fns"
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

  const todayJST = getTodayJST()
  const todayYear = todayJST.getUTCFullYear()
  const todayMonth = todayJST.getUTCMonth() + 1
  const todayDateString = format(todayJST, "yyyy-MM-dd")

  const [todayShifts, todayDuties, todayChanges, filterOptions, roles, session, activeShiftCodes, shiftIdsWithHistorySet, latestHistoryEntries, dutyTypes, allEmployees, overnightShifts, overnightDuties] =
    await Promise.all([
      getTodayOverview(filter),
      getTodayDutyAssignments(),
      getTodayShiftChangeHistory(),
      getDashboardFilterOptions(),
      getFunctionRoles(),
      auth(),
      getActiveShiftCodes(),
      getShiftIdsWithHistory(todayYear, todayMonth),
      getLatestShiftHistoryEntries(todayYear, todayMonth),
      getActiveDutyTypes(),
      getAllEmployees(),
      getYesterdayOvernightShifts(),
      getYesterdayOvernightDutyAssignments(),
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
            <CapacitySummary
              shifts={[
                ...todayShifts.map((s) => ({
                  employeeId: s.employeeId,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  groups: s.employee?.groups.map((eg) => ({ id: eg.group.id, name: eg.group.name })) ?? [],
                  roles: s.employee?.functionRoles.filter((efr) => efr.functionRole).map((efr) => ({ roleType: efr.functionRole!.roleType, roleName: efr.functionRole!.roleName })) ?? [],
                })),
                ...overnightShifts.map((s) => ({
                  employeeId: s.employeeId,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  groups: s.employee?.groups.map((eg) => ({ id: eg.group.id, name: eg.group.name })) ?? [],
                  roles: s.employee?.functionRoles.filter((efr) => efr.functionRole).map((efr) => ({ roleType: efr.functionRole!.roleType, roleName: efr.functionRole!.roleName })) ?? [],
                })),
              ]}
              duties={[
                ...todayDuties.map((d) => ({
                  employeeId: d.employeeId,
                  startTime: d.startTime,
                  endTime: d.endTime,
                  reducesCapacity: d.reducesCapacity,
                })),
                ...overnightDuties.map((d) => ({
                  employeeId: d.employeeId,
                  startTime: d.startTime,
                  endTime: d.endTime,
                  reducesCapacity: d.reducesCapacity,
                })),
              ]}
              roleTypes={distinctRoleTypes}
            />
            <TodayDuties
              duties={todayDuties}
              employees={allEmployees.map((e) => ({ id: e.id, name: e.name }))}
              dutyTypes={dutyTypes.map((dt) => ({ id: dt.id, code: dt.code, name: dt.name, defaultReducesCapacity: dt.defaultReducesCapacity }))}
              isAuthenticated={!!session?.user}
              todayDateString={todayDateString}
            />
            <TodayAttendance
              changes={todayChanges}
              employees={allEmployees.map((e) => ({ id: e.id, name: e.name }))}
              shiftCodes={activeShiftCodes}
              isAuthenticated={!!session?.user}
              todayDateString={todayDateString}
            />
          </div>
          <TodayOverviewClient
            shifts={todayShifts}
            overnightShifts={overnightShifts}
            filterOptions={filterOptions}
            distinctRoleTypes={distinctRoleTypes}
            isAuthenticated={!!session?.user}
            shiftCodes={activeShiftCodes}
            shiftIdsWithHistory={[...shiftIdsWithHistorySet]}
            shiftLatestHistory={latestHistoryEntries}
            todayDateString={todayDateString}
          />
        </div>
      </PageContainer>
    </>
  )
}
