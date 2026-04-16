import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { DataPageClient } from "@/components/data/data-page-client"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"

export default async function DataPage() {
  const [groups, roles] = await Promise.all([
    getGroups(),
    getFunctionRoles(),
  ])

  return (
    <>
      <PageHeader
        title="データ"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "設定" },
          { label: "データ" },
        ]}
      />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">データ</h1>
        <DataPageClient groups={groups} roles={roles} />
      </PageContainer>
    </>
  )
}
