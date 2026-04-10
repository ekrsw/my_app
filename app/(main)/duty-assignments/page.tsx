import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { DutyAssignmentPageClient } from "@/components/duty-assignments/duty-assignment-page-client"
import {
  getDutyAssignmentsForDaily,
  getDutyAssignmentsForCalendar,
  getDutyDailyFilterOptions,
} from "@/lib/db/duty-assignments"
import { getActiveDutyTypes } from "@/lib/db/duty-types"
import { getAllEmployees } from "@/lib/db/employees"
import { getShiftsForCalendar } from "@/lib/db/shifts"
import { getActiveShiftCodes } from "@/lib/db/shift-codes"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"
import { getTodayJST } from "@/lib/date-utils"
import { SHIFT_CODE_MAP, getColorClasses, type ShiftCodeInfo } from "@/lib/constants"
import { auth } from "@/auth"
import type { DutyDailySortField, ShiftCodeMap, SortOrder } from "@/types/duties"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
    const dailyDateStr = isNaN(parsedDate.getTime()) ? todayStr : rawDateStr
    const dailyDate = isNaN(parsedDate.getTime()) ? today : parsedDate

    // フィルターパラメータ
    const employeeIds = typeof params.employeeIds === "string" ? params.employeeIds.split(",") : []
    const groupIds = typeof params.groupIds === "string" ? params.groupIds.split(",").map(Number).filter(Boolean) : []
    const dutyTypeIds = typeof params.dutyTypeIds === "string" ? params.dutyTypeIds.split(",").map(Number).filter(Boolean) : []
    const reducesCapacityParam = typeof params.reducesCapacity === "string" ? params.reducesCapacity : null
    const reducesCapacity = reducesCapacityParam === "true" ? true : reducesCapacityParam === "false" ? false : null
    const sortBy = (typeof params.sortBy === "string" ? params.sortBy : "startTime") as DutyDailySortField
    const sortOrder = (typeof params.sortOrder === "string" ? params.sortOrder : "asc") as SortOrder

    const filterParams = {
      date: dailyDate,
      employeeIds: employeeIds.length > 0 ? employeeIds : undefined,
      groupIds: groupIds.length > 0 ? groupIds : undefined,
      dutyTypeIds: dutyTypeIds.length > 0 ? dutyTypeIds : undefined,
      reducesCapacity,
      sortBy,
      sortOrder,
    }

    const [result, filterOptions] = await Promise.all([
      getDutyAssignmentsForDaily(filterParams),
      getDutyDailyFilterOptions(dailyDate),
    ])

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
            dailyData={result.data}
            dailyTotal={result.total}
            dailyHasMore={result.hasMore}
            dailyNextCursor={result.nextCursor}
            dailyDate={dailyDateStr}
            filterOptions={filterOptions}
            employeeIds={employeeIds}
            groupIds={groupIds}
            dutyTypeIds={dutyTypeIds}
            reducesCapacity={reducesCapacity}
            sortBy={sortBy}
            sortOrder={sortOrder}
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
  }

  const [calendarResult, groups, roles, shiftData, shiftCodes] = await Promise.all([
    getDutyAssignmentsForCalendar(calendarFilter),
    getGroups(),
    getFunctionRoles(),
    getShiftsForCalendar({ year, month }),
    getActiveShiftCodes(),
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
  for (const emp of shiftData) {
    const shifts: Record<string, string> = {}
    for (const [dateStr, shift] of Object.entries(emp.shifts)) {
      if (shift.shiftCode) shifts[dateStr] = shift.shiftCode
    }
    shiftCodeMap[emp.employeeId] = shifts
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
          dailyData={[]}
          dailyTotal={0}
          dailyHasMore={false}
          dailyNextCursor={null}
          dailyDate={todayStr}
          filterOptions={{ employees: [], groups: [], dutyTypes: [] }}
          employeeIds={[]}
          groupIds={[]}
          dutyTypeIds={[]}
          reducesCapacity={null}
          sortBy="startTime"
          sortOrder="asc"
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
          groups={groups.map((g) => ({ id: g.id, name: g.name }))}
          roles={roles.map((r) => ({ id: r.id, roleName: r.roleName }))}
          employeeOptions={employeeOptions}
          dutyTypeOptions={dutyTypeOptions}
        />
      </PageContainer>
    </>
  )
}
