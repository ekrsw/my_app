import { PageHeader } from "@/components/layout/page-header"
import { ROUTES } from "@/lib/routes"
import { PageContainer } from "@/components/layout/page-container"
import { PositionTable } from "@/components/positions/position-table"
import { getPositions } from "@/lib/db/positions"
import { PositionForm } from "@/components/positions/position-form"
import { auth } from "@/auth"

export default async function PositionsPage() {
  const session = await auth()
  const isAuthenticated = !!session?.user
  const positions = await getPositions()

  return (
    <>
      <PageHeader
        title="役職管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: ROUTES.top },
          { label: "役職管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">役職管理</h1>
          {isAuthenticated && <PositionForm />}
        </div>
        <PositionTable data={positions} />
      </PageContainer>
    </>
  )
}
