import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { SealedNotice } from "@/components/crypto/sealed-notice"
import { isKeyringSealedError } from "@/lib/crypto/errors"
import { DailyOverviewClient } from "@/components/dashboard/daily-overview-client"
import { TodayDuties } from "@/components/dashboard/today-duties"
import { TodayAttendance } from "@/components/dashboard/today-attendance"
import {
  getDailyOverview,
  getDailyFilterOptions,
  getTodayShiftChangeHistory,
  getPreviousDayOvernightShifts,
} from "@/lib/db/dashboard"
import { getDailyDutyAssignments } from "@/lib/db/duty-assignments"
import { getActiveDutyTypes } from "@/lib/db/duty-types"
import { getAllEmployees } from "@/lib/db/employees"
import { auth } from "@/auth"
import { getActiveShiftCodes } from "@/lib/db/shift-codes"
import { getShiftIdsWithHistory, getLatestShiftHistoryEntries } from "@/lib/db/shifts"
import { getTodayJST } from "@/lib/date-utils"
import { format } from "date-fns"
import { DISTINCT_ROLE_TYPES } from "@/lib/constants/role-types"
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

  // 暗号化列（業務割当・業務種別のメモ/タイトル）を含むため、sealed 中は復号できず throw する。
  // 500 にせず「🔒 ロック中」を表示する（duty-assignments / duty-types ページと同じ扱い）。
  // tuple 型は Promise.all から推論させる（auth() のオーバーロードを手書きで誤らないため）。
  const dashboardData = await Promise.all([
    getDailyOverview(todayJST, filter),
    getDailyDutyAssignments(todayJST),
    getTodayShiftChangeHistory(),
    getDailyFilterOptions(todayJST),
    auth(),
    getActiveShiftCodes(),
    getShiftIdsWithHistory(todayYear, todayMonth),
    getLatestShiftHistoryEntries(todayYear, todayMonth),
    getActiveDutyTypes(),
    getAllEmployees(),
    getPreviousDayOvernightShifts(todayJST, filter),
  ]).catch((e: unknown) => {
    if (isKeyringSealedError(e)) return null
    throw e
  })

  if (dashboardData === null) {
    return (
      <>
        <PageHeader title="ダッシュボード" breadcrumbs={[{ label: "ダッシュボード" }]} />
        <PageContainer>
          <SealedNotice description="本日の業務情報は暗号化されています。表示するには管理者によるアンロックが必要です。" />
        </PageContainer>
      </>
    )
  }

  const [todayShifts, todayDuties, todayChanges, filterOptions, session, activeShiftCodes, shiftIdsWithHistorySet, latestHistoryEntries, dutyTypes, allEmployees, overnightShifts] =
    dashboardData

  // roleTypes[0] = SV (監督系)、roleTypes[1] = 業務系で固定 (lib/constants/role-types.ts)
  const distinctRoleTypes = DISTINCT_ROLE_TYPES

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        breadcrumbs={[{ label: "ダッシュボード" }]}
      />
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="flex flex-col gap-6">
            <TodayDuties
              duties={todayDuties}
              employees={allEmployees.map((e) => ({ id: e.id, name: e.name }))}
              dutyTypes={dutyTypes.map((dt) => ({ id: dt.id, name: dt.name, defaultReducesCapacity: dt.defaultReducesCapacity, defaultStartTime: dt.defaultStartTime, defaultEndTime: dt.defaultEndTime, defaultNote: dt.defaultNote, defaultTitle: dt.defaultTitle }))}
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
          <DailyOverviewClient
            date={todayDateString}
            isToday={true}
            shifts={todayShifts}
            overnightShifts={overnightShifts}
            filterOptions={filterOptions}
            distinctRoleTypes={distinctRoleTypes}
            isAuthenticated={!!session?.user}
            shiftCodes={activeShiftCodes}
            shiftIdsWithHistory={[...shiftIdsWithHistorySet]}
            shiftLatestHistory={latestHistoryEntries}
            dutyAssignments={todayDuties}
            employees={allEmployees.map((e) => ({ id: e.id, name: e.name }))}
            dutyTypes={dutyTypes.map((dt) => ({ id: dt.id, name: dt.name, defaultReducesCapacity: dt.defaultReducesCapacity, defaultStartTime: dt.defaultStartTime, defaultEndTime: dt.defaultEndTime, defaultNote: dt.defaultNote, defaultTitle: dt.defaultTitle }))}
          />
        </div>
      </PageContainer>
    </>
  )
}
