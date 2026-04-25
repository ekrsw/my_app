import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { DutyAssignmentPageClient } from "@/components/duty-assignments/duty-assignment-page-client"
import {
  getDutyAssignmentsForCalendar,
  getDailyDutyAssignments,
} from "@/lib/db/duty-assignments"
import {
  getDailyOverview,
  getDailyFilterOptions,
  getPreviousDayOvernightShifts,
} from "@/lib/db/dashboard"
import { getActiveDutyTypes } from "@/lib/db/duty-types"
import { getAllEmployees } from "@/lib/db/employees"
import { getShiftsForCalendar, getShiftIdsWithHistory, getLatestShiftHistoryEntries } from "@/lib/db/shifts"
import { getActiveShiftCodes } from "@/lib/db/shift-codes"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"
import { getTodayJST } from "@/lib/date-utils"
import { SHIFT_CODE_MAP, getColorClasses, type ShiftCodeInfo } from "@/lib/constants"
import { DISTINCT_ROLE_TYPES } from "@/lib/constants/role-types"
import { auth } from "@/auth"
import type { DashboardOverviewFilter } from "@/types"
import type { ShiftCodeMap } from "@/types/duties"
import type { Shift } from "@/app/generated/prisma/client"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

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

export default async function DutyAssignmentsPage({ searchParams }: Props) {
  const params = await searchParams
  const viewMode = params.view === "daily" ? "daily" : "monthly" as const

  const session = await auth()
  const isAuthenticated = !!session?.user

  const today = getTodayJST()
  const todayStr = today.toISOString().substring(0, 10)

  // フォーム用データ（両ビュー共通）
  const [employees, dutyTypes] = await Promise.all([
    getAllEmployees(),
    getActiveDutyTypes(),
  ])

  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name }))
  const dutyTypeOptions = dutyTypes.map((dt) => ({
    id: dt.id,
    name: dt.name,
    defaultReducesCapacity: dt.defaultReducesCapacity,
    defaultStartTime: dt.defaultStartTime,
    defaultEndTime: dt.defaultEndTime,
    defaultNote: dt.defaultNote,
    defaultTitle: dt.defaultTitle,
  }))

  if (viewMode === "daily") {
    // --- 日次ビュー ---
    const rawDateStr = typeof params.dailyDate === "string" ? params.dailyDate : todayStr
    const parsedDate = new Date(rawDateStr + "T00:00:00Z")
    // ISO 形式 (YYYY-MM-DD) かつ round-trip で同一の場合のみ受け入れる
    // ("2025-02-30" → JS では 3/2 に rollover → 弾く)
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDateStr)
      && !isNaN(parsedDate.getTime())
      && parsedDate.toISOString().substring(0, 10) === rawDateStr
    const dailyDateStr = isValidDate ? rawDateStr : todayStr
    const dailyDate = isValidDate ? parsedDate : today

    // URL フィルタパラメータ（ダッシュボードと共有）
    const dailyGroupIds = parseIds(params.groupIds)
    const dailyUnassigned = params.unassigned === "true"
    const dailyEmployeeIds = parseStrings(params.employeeIds)
    const dailyShiftCodes = parseStrings(params.shiftCodes)
    const dailySupervisorRoleNames = parseStrings(params.supervisorRoleNames)
    const dailyBusinessRoleNames = parseStrings(params.businessRoleNames)
    const dailyIsRemote = params.isRemote === "true" || undefined

    const filter: DashboardOverviewFilter = {
      groupIds: dailyGroupIds,
      unassigned: dailyUnassigned,
      employeeIds: dailyEmployeeIds,
      shiftCodes: dailyShiftCodes,
      supervisorRoleNames: dailySupervisorRoleNames,
      businessRoleNames: dailyBusinessRoleNames,
      isRemote: dailyIsRemote,
    }

    const dailyYear = dailyDate.getUTCFullYear()
    const dailyMonth = dailyDate.getUTCMonth() + 1

    const [
      dailyShifts,
      dailyDuties,
      overnightShifts,
      filterOptions,
      roles,
      activeShiftCodes,
      shiftIdsWithHistorySet,
      latestHistoryEntries,
    ] = await Promise.all([
      getDailyOverview(dailyDate, filter),
      getDailyDutyAssignments(dailyDate),
      getPreviousDayOvernightShifts(dailyDate, filter),
      getDailyFilterOptions(dailyDate),
      getFunctionRoles(),
      getActiveShiftCodes(),
      getShiftIdsWithHistory(dailyYear, dailyMonth),
      getLatestShiftHistoryEntries(dailyYear, dailyMonth),
    ])

    // roleTypes[0] = SV (監督系)、roleTypes[1] = 業務系で固定 (lib/constants/role-types.ts)
    const distinctRoleTypes = DISTINCT_ROLE_TYPES

    return (
      <>
        <PageHeader
          title="業務管理"
          breadcrumbs={[
            { label: "ダッシュボード", href: "/" },
            { label: "業務管理" },
          ]}
        />
        <PageContainer>
          <DutyAssignmentPageClient
            viewMode="daily"
            isAuthenticated={isAuthenticated}
            dailyDate={dailyDateStr}
            dailyIsToday={dailyDateStr === todayStr}
            dailyShifts={dailyShifts}
            dailyOvernightShifts={overnightShifts}
            dailyDuties={dailyDuties}
            dailyFilterOptions={filterOptions}
            dailyDistinctRoleTypes={distinctRoleTypes}
            dailyShiftCodes={activeShiftCodes}
            dailyShiftIdsWithHistory={[...shiftIdsWithHistorySet]}
            dailyShiftLatestHistory={latestHistoryEntries}
            calendarData={[]}
            dutyTypeSummary={[]}
            calendarTotal={0}
            calendarHasMore={false}
            calendarNextCursor={null}
            year={today.getUTCFullYear()}
            month={today.getUTCMonth() + 1}
            monthlyEmployeeIds={[]}
            monthlyGroupIds={[]}
            monthlyUnassigned={false}
            monthlyRoleIds={[]}
            monthlyRoleUnassigned={false}
            monthlyDutyTypeIds={[]}
            monthlyDutyUnassigned={false}
            groups={[]}
            roles={[]}
            shiftCodeMap={{}}
            shiftCodeInfoMap={{}}
            shiftDataMap={{}}
            shiftCodes={[]}
            shiftIdsWithHistory={[]}
            shiftLatestHistory={{}}
            employeeOptions={employeeOptions}
            dutyTypeOptions={dutyTypeOptions}
          />
        </PageContainer>
      </>
    )
  }

  // --- 月次ビュー ---
  const rawYear = typeof params.year === "string" ? parseInt(params.year, 10) : today.getUTCFullYear()
  const rawMonth = typeof params.month === "string" ? parseInt(params.month, 10) : today.getUTCMonth() + 1
  const year = (Number.isFinite(rawYear) && rawYear >= 2000 && rawYear <= 2100) ? rawYear : today.getUTCFullYear()
  const month = (Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12) ? rawMonth : today.getUTCMonth() + 1
  const monthlyEmployeeIds = typeof params.monthlyEmployeeIds === "string"
    ? params.monthlyEmployeeIds.split(",").filter(Boolean)
    : []
  const monthlyGroupIds = typeof params.monthlyGroupIds === "string"
    ? params.monthlyGroupIds.split(",").map(Number).filter(Boolean)
    : []
  const monthlyUnassigned = params.monthlyUnassigned === "true"
  const monthlyRoleIds = typeof params.monthlyRoleIds === "string"
    ? params.monthlyRoleIds.split(",").map(Number).filter(Boolean)
    : []
  const monthlyRoleUnassigned = params.monthlyRoleUnassigned === "true"
  const monthlyDutyTypeIds = typeof params.monthlyDutyTypeIds === "string"
    ? params.monthlyDutyTypeIds.split(",").map(Number).filter(Boolean)
    : []
  const monthlyDutyUnassigned = params.monthlyDutyUnassigned === "true"
  const monthlyEmployeeSearch = typeof params.monthlyEmployeeSearch === "string"
    ? params.monthlyEmployeeSearch
    : undefined

  const calendarFilter = {
    year,
    month,
    groupIds: monthlyGroupIds.length > 0 ? monthlyGroupIds : undefined,
    unassigned: monthlyUnassigned || undefined,
    roleIds: monthlyRoleIds.length > 0 ? monthlyRoleIds : undefined,
    roleUnassigned: monthlyRoleUnassigned || undefined,
    dutyTypeIds: monthlyDutyTypeIds.length > 0 ? monthlyDutyTypeIds : undefined,
    dutyUnassigned: monthlyDutyUnassigned || undefined,
    employeeIds: monthlyEmployeeIds.length > 0 ? monthlyEmployeeIds : undefined,
    employeeSearch: monthlyEmployeeSearch || undefined,
  }

  const [calendarResult, groups, roles, shiftData, shiftCodes, shiftIdsWithHistorySet, shiftLatestHistory] = await Promise.all([
    getDutyAssignmentsForCalendar(calendarFilter),
    getGroups(),
    getFunctionRoles(),
    getShiftsForCalendar({ year, month }),
    getActiveShiftCodes(),
    getShiftIdsWithHistory(year, month),
    getLatestShiftHistoryEntries(year, month),
  ])

  // ShiftCode マスタ → ShiftCodeInfo マップ（DB カラー解決用）
  const shiftCodeInfoMap: Record<string, ShiftCodeInfo> = {}
  for (const sc of shiftCodes) {
    const dbColor = getColorClasses(sc.color)
    const hardcoded = SHIFT_CODE_MAP[sc.code]
    shiftCodeInfoMap[sc.code] = {
      label: hardcoded?.label ?? sc.code,
      color: dbColor?.text ?? hardcoded?.color ?? "text-gray-800",
      bgColor: dbColor?.bg ?? hardcoded?.bgColor ?? "bg-gray-100",
    }
  }

  // ShiftCalendarData[] → ShiftCodeMap に変換
  const shiftCodeMap: ShiftCodeMap = {}
  const shiftDataMap: Record<string, Record<string, Shift>> = {}
  for (const emp of shiftData) {
    const shifts: Record<string, string> = {}
    const shiftObjects: Record<string, Shift> = {}
    for (const [dateStr, shift] of Object.entries(emp.shifts)) {
      if (shift.shiftCode) shifts[dateStr] = shift.shiftCode
      shiftObjects[dateStr] = shift
    }
    shiftCodeMap[emp.employeeId] = shifts
    shiftDataMap[emp.employeeId] = shiftObjects
  }

  return (
    <>
      <PageHeader
        title="業務管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "業務管理" },
        ]}
      />
      <PageContainer>
        <DutyAssignmentPageClient
          viewMode="monthly"
          isAuthenticated={isAuthenticated}
          dailyDate={todayStr}
          dailyIsToday={true}
          dailyShifts={[]}
          dailyOvernightShifts={[]}
          dailyDuties={[]}
          dailyFilterOptions={{ employees: [], groups: [], shiftCodes: [], hasUnassigned: false, supervisorRoleNames: [], businessRoleNames: [] }}
          dailyDistinctRoleTypes={DISTINCT_ROLE_TYPES}
          dailyShiftCodes={[]}
          dailyShiftIdsWithHistory={[]}
          dailyShiftLatestHistory={{}}
          calendarData={calendarResult.data}
          dutyTypeSummary={calendarResult.dutyTypeSummary}
          calendarTotal={calendarResult.total}
          calendarHasMore={calendarResult.hasMore}
          calendarNextCursor={calendarResult.nextCursor}
          year={year}
          month={month}
          monthlyEmployeeIds={monthlyEmployeeIds}
          monthlyGroupIds={monthlyGroupIds}
          monthlyUnassigned={monthlyUnassigned}
          monthlyRoleIds={monthlyRoleIds}
          monthlyRoleUnassigned={monthlyRoleUnassigned}
          monthlyDutyTypeIds={monthlyDutyTypeIds}
          monthlyDutyUnassigned={monthlyDutyUnassigned}
          shiftCodeMap={shiftCodeMap}
          shiftCodeInfoMap={shiftCodeInfoMap}
          shiftDataMap={shiftDataMap}
          shiftCodes={shiftCodes}
          shiftIdsWithHistory={Array.from(shiftIdsWithHistorySet)}
          shiftLatestHistory={shiftLatestHistory}
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          roles={roles.map((r) => ({ id: r.id, roleName: r.roleName }))}
          employeeOptions={employeeOptions}
          dutyTypeOptions={dutyTypeOptions}
        />
      </PageContainer>
    </>
  )
}
