import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { DutyTypeTable } from "@/components/duty-types/duty-type-table"
import { DutyTypeForm } from "@/components/duty-types/duty-type-form"
import { getDutyTypes } from "@/lib/db/duty-types"
import { auth } from "@/auth"

export default async function DutyTypesPage() {
  const session = await auth()
  const isAuthenticated = !!session?.user
  const dutyTypes = await getDutyTypes()

  return (
    <>
      <PageHeader
        title="業務種別管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "業務種別管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">業務種別管理</h1>
          <div className="flex items-center gap-2">
            {isAuthenticated && <DutyTypeForm />}
          </div>
        </div>
        <DutyTypeTable data={dutyTypes} />
      </PageContainer>
    </>
  )
}
