import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TodayOverviewClient } from "@/components/dashboard/today-overview-client"
import { TodayDuties } from "@/components/dashboard/today-duties"
import { RecentChanges } from "@/components/dashboard/recent-changes"
import { getDashboardStats, getTodayOverview } from "@/lib/db/dashboard"
import { getTodayDutyAssignments } from "@/lib/db/duty-assignments"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"

function parseIds(value: string | string[] | undefined): number[] {
  const str = Array.isArray(value) ? value[0] : value
  if (!str) return []
  return str.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const groupIds = parseIds(params.groupIds)
  const unassigned = params.unassigned === "true"
  const roleIds = parseIds(params.roleIds)
  const roleUnassigned = params.roleUnassigned === "true"

  const [stats, todayShifts, todayDuties, groups, roles] = await Promise.all([
    getDashboardStats(),
    getTodayOverview({ groupIds, unassigned, roleIds, roleUnassigned }),
    getTodayDutyAssignments(),
    getGroups(),
    getFunctionRoles(),
  ])

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        breadcrumbs={[{ label: "ダッシュボード" }]}
      />
      <PageContainer>
        <StatsCards
          activeEmployees={stats.activeEmployees}
          totalEmployees={stats.totalEmployees}
          todayShifts={stats.todayShifts}
          todayRemote={stats.todayRemote}
          todayDuties={stats.todayDuties}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <TodayOverviewClient
            shifts={todayShifts}
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
            roles={roles.map((r) => ({ id: r.id, roleName: r.roleName }))}
          />
          <TodayDuties duties={todayDuties} />
          <RecentChanges changes={stats.recentChanges} />
        </div>
      </PageContainer>
    </>
  )
}
