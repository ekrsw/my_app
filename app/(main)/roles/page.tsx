import { connection } from "next/server"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { getFunctionRoles } from "@/lib/db/roles"
import { RoleForm } from "@/components/roles/role-form"
import { RoleTable } from "@/components/roles/role-table"
import { auth } from "@/auth"

export default async function RolesPage() {
  await connection()
  const session = await auth()
  const isAuthenticated = !!session?.user
  const roles = await getFunctionRoles()

  return (
    <>
      <PageHeader
        title="ロール管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "ロール管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">ロール管理</h1>
          {isAuthenticated && <RoleForm />}
        </div>
        <RoleTable data={roles} />
      </PageContainer>
    </>
  )
}
