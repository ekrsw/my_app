import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { GroupTable } from "@/components/groups/group-table"
import { GroupForm } from "@/components/groups/group-form"
import { getGroups } from "@/lib/db/groups"

export default async function GroupsPage() {
  const groups = await getGroups()

  return (
    <>
      <PageHeader
        title="グループ管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "グループ管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">グループ管理</h1>
          <GroupForm />
        </div>
        <GroupTable data={groups} />
      </PageContainer>
    </>
  )
}
