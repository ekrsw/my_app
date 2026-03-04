import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { getFunctionRoles } from "@/lib/db/roles"
import { RoleForm } from "@/components/roles/role-form"
import { RoleTabs } from "@/components/roles/role-tabs"
import type { SearchParams } from "@/types"

export default async function RolesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const activeTab = (params.tab as string) ?? "all"

  const roleTypeMap: Record<string, string | undefined> = {
    all: undefined,
    function: "FUNCTION",
    authority: "AUTHORITY",
  }

  const roles = await getFunctionRoles(roleTypeMap[activeTab])

  return (
    <>
      <PageHeader
        title="役割管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "役割管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">役割管理</h1>
          <RoleForm />
        </div>
        <RoleTabs activeTab={activeTab} roles={roles} />
      </PageContainer>
    </>
  )
}
