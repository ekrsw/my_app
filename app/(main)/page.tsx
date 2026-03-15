import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TodayOverviewClient } from "@/components/dashboard/today-overview-client"
import { RecentChanges } from "@/components/dashboard/recent-changes"
import { getDashboardStats, getTodayOverview } from "@/lib/db/dashboard"
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

  const [stats, todayShifts, groups, roles] = await Promise.all([
    getDashboardStats(),
    getTodayOverview({ groupIds, unassigned, roleIds, roleUnassigned }),
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
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TodayOverviewClient
            shifts={todayShifts}
            groups={groups.map((g) => ({ id: g.id, name: g.name }))}
            roles={roles.map((r) => ({ id: r.id, roleName: r.roleName }))}
          />
          <RecentChanges changes={stats.recentChanges} />
        </div>
      </PageContainer>
    </>
  )
}
