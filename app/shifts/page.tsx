import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftPageClient } from "@/components/shifts/shift-page-client"
import { ShiftTabs } from "@/components/shifts/shift-tabs"
import { ShiftHistoryTable } from "@/components/shifts/shift-history-table"
import { ShiftHistoryFilters } from "@/components/shifts/shift-history-filters"
import { TabsContent } from "@/components/ui/tabs"
import { getShiftsForCalendarPaginated, getShiftIdsWithHistory, getLatestShiftHistoryEntries, getShiftsForDaily, getDailyFilterOptions } from "@/lib/db/shifts"
import { getShiftHistory } from "@/lib/db/history"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"
import { getActiveShiftCodes } from "@/lib/db/shift-codes"
import { toDateString, getTodayJST } from "@/lib/date-utils"
import type { SearchParams, ShiftDailySortField } from "@/types"

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1
  const groupIds = params.groupIds
    ? String(params.groupIds).split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : params.groupId
      ? [Number(params.groupId)].filter((n) => !isNaN(n) && n > 0)
      : undefined
  const unassigned = params.unassigned === "true"
  const roleIds = params.roleIds
    ? String(params.roleIds).split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : undefined
  const roleUnassigned = params.roleUnassigned === "true"
  const search = params.search as string | undefined
  const page = Number(params.page) || 1
  const activeTab = (params.tab as string) ?? "management"

  const historyDate = params.historyDate as string | undefined
  const historyEmployee = params.historyEmployee as string | undefined
  const isHistory = activeTab === "history"

  // 日次/月次ビュー
  const viewMode = params.view === "daily" ? "daily" : "monthly"
  const isDaily = viewMode === "daily" && !isHistory
  const dailyDate = (params.dailyDate as string) || toDateString(getTodayJST())
  const dailyPage = Number(params.dailyPage) || 1
  const shiftCodesFilter = params.shiftCodes
    ? String(params.shiftCodes).split(",").filter(Boolean)
    : undefined
  const startTimeFrom = (params.startTimeFrom as string) || undefined
  const endTimeTo = (params.endTimeTo as string) || undefined
  const dailySortBy = (params.dailySortBy as string) || undefined
  const dailySortOrder = (params.dailySortOrder as string) === "desc" ? "desc" as const : "asc" as const
  const dailyIsHoliday = params.dailyIsHoliday === "true" ? true : undefined
  const dailyIsRemote = params.dailyIsRemote === "true" ? true : undefined
  const employeeIds = params.employeeIds
    ? String(params.employeeIds).split(",").filter(Boolean)
    : undefined

  const filter = { year, month, groupIds: groupIds && groupIds.length > 0 ? groupIds : undefined, unassigned, roleIds: roleIds && roleIds.length > 0 ? roleIds : undefined, roleUnassigned, employeeSearch: search }

  const validSortFields: ShiftDailySortField[] = ["employeeName", "groupName", "shiftCode", "startTime", "endTime", "isHoliday", "isRemote"]
  const dailySortByValidated = validSortFields.includes(dailySortBy as ShiftDailySortField)
    ? (dailySortBy as ShiftDailySortField)
    : undefined

  const dailyFilter = {
    date: dailyDate,
    groupIds: groupIds && groupIds.length > 0 ? groupIds : undefined,
    unassigned: unassigned || undefined,
    shiftCodes: shiftCodesFilter,
    employeeIds,
    startTimeFrom,
    endTimeTo,
    isHoliday: dailyIsHoliday,
    isRemote: dailyIsRemote,
    sortBy: dailySortByValidated,
    sortOrder: dailySortByValidated ? dailySortOrder : undefined,
  }

  const [calendarResult, groups, roles, shiftCodes, historyResult, shiftIdsWithHistorySet, latestNotes, dailyResult, dailyFilterOptions] =
    await Promise.all([
      isHistory || isDaily
        ? Promise.resolve({ data: [], total: 0, hasMore: false, nextCursor: null })
        : getShiftsForCalendarPaginated(filter, { cursor: 0, pageSize: 50 }),
      getGroups(),
      getFunctionRoles(),
      isHistory
        ? Promise.resolve([])
        : getActiveShiftCodes(),
      isHistory
        ? getShiftHistory({ page, pageSize: 20 }, {
            ...(historyDate && { shiftDate: historyDate }),
            ...(historyEmployee && { employeeName: historyEmployee }),
          })
        : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
      isHistory || isDaily
        ? Promise.resolve(new Set<number>())
        : getShiftIdsWithHistory(year, month),
      isHistory || isDaily
        ? Promise.resolve({})
        : getLatestShiftHistoryEntries(year, month),
      isDaily
        ? getShiftsForDaily(dailyFilter, { page: dailyPage })
        : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 30, totalPages: 0 }),
      isDaily
        ? getDailyFilterOptions(dailyFilter)
        : Promise.resolve({ employees: [], groups: [], shiftCodes: [], hasUnassigned: false }),
    ])

  return (
    <>
      <PageHeader
        title="シフト管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "シフト管理" },
        ]}
      />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">シフト管理</h1>
        <ShiftTabs activeTab={activeTab}>
          <TabsContent value="management" className="mt-4">
            <ShiftPageClient
              viewMode={viewMode}
              initialCalendarData={calendarResult.data}
              calendarTotal={calendarResult.total}
              calendarHasMore={calendarResult.hasMore}
              calendarNextCursor={calendarResult.nextCursor}
              calendarFilter={filter}
              groups={groups}
              roles={roles}
              year={year}
              month={month}
              shiftCodes={shiftCodes}
              shiftIdsWithHistory={[...shiftIdsWithHistorySet]}
              shiftLatestHistory={latestNotes}
              dailyData={dailyResult.data}
              dailyTotal={dailyResult.total}
              dailyPage={dailyResult.page}
              dailyTotalPages={dailyResult.totalPages}
              dailyDate={dailyDate}
              dailyGroupIds={groupIds ?? []}
              dailyUnassigned={unassigned}
              dailySelectedShiftCodes={shiftCodesFilter ?? []}
              dailyEmployeeIds={employeeIds ?? []}
              dailyEmployees={dailyFilterOptions.employees}
              dailyStartTimeFrom={startTimeFrom ?? ""}
              dailyEndTimeTo={endTimeTo ?? ""}
              dailySortBy={dailySortByValidated ?? "employeeName"}
              dailySortOrder={dailySortByValidated ? dailySortOrder : "asc"}
              dailyIsHoliday={dailyIsHoliday ?? false}
              dailyIsRemote={dailyIsRemote ?? false}
              dailyShiftCodeOptions={dailyFilterOptions.shiftCodes}
              dailyGroupOptions={dailyFilterOptions.groups}
              dailyHasUnassigned={dailyFilterOptions.hasUnassigned}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <ShiftHistoryFilters />
            <p className="text-sm text-muted-foreground mb-4">
              {historyResult.total}件の変更履歴
            </p>
            <ShiftHistoryTable
              data={historyResult.data}
              pageCount={historyResult.totalPages}
              page={page}
            />
          </TabsContent>
        </ShiftTabs>
      </PageContainer>
    </>
  )
}
