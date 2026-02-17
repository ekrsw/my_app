import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { RoleTable } from "@/components/roles/role-table"
import { getFunctionRoles } from "@/lib/db/roles"
import { RoleForm } from "@/components/roles/role-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SearchParams } from "@/types"

export default async function RolesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const activeTab = (params.tab as string) ?? "all"

  const roleTypeMap: Record<string, string | undefined> = {
    all: undefined,
    function: "FUNCTION",
    authority: "AUTHORITY",
    position: "POSITION",
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
        <Tabs defaultValue={activeTab}>
          <TabsList>
            <TabsTrigger value="all">
              <a href="/roles?tab=all">すべて</a>
            </TabsTrigger>
            <TabsTrigger value="function">
              <a href="/roles?tab=function">業務役割</a>
            </TabsTrigger>
            <TabsTrigger value="authority">
              <a href="/roles?tab=authority">監督権限</a>
            </TabsTrigger>
            <TabsTrigger value="position">
              <a href="/roles?tab=position">役職</a>
            </TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
            <RoleTable data={roles} />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </>
  )
}
