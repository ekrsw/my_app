import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { TodayOverview } from "@/components/dashboard/today-overview"
import { RecentChanges } from "@/components/dashboard/recent-changes"
import { getDashboardStats, getTodayOverview } from "@/lib/db/dashboard"

export default async function DashboardPage() {
  const [stats, todayShifts] = await Promise.all([
    getDashboardStats(),
    getTodayOverview(),
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
          todayPaidLeave={stats.todayPaidLeave}
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <TodayOverview shifts={todayShifts} />
          <RecentChanges changes={stats.recentChanges} />
        </div>
      </PageContainer>
    </>
  )
}
