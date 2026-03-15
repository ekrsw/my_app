import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { EmployeeTable } from "@/components/employees/employee-table"
import { EmployeeFilters } from "@/components/employees/employee-filters"
import { getEmployees } from "@/lib/db/employees"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"
import { EmployeeForm } from "@/components/employees/employee-form"
import { EmployeeImportDialog } from "@/components/employees/employee-import-dialog"
import { EmployeeExportButton } from "@/components/employees/employee-export-button"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { SearchParams } from "@/types"
import { auth } from "@/auth"

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || 20
  const search = params.search as string | undefined
  const activeOnly = params.activeOnly === "true"

  // グループフィルター解析（複数選択対応、旧 groupId もフォールバック）
  const rawGroupIds = params.groupIds as string | undefined
  const rawGroupId = params.groupId as string | undefined
  const unassigned = params.unassigned === "true" || rawGroupId === "none"
  let groupIds: number[] | undefined
  if (rawGroupIds) {
    groupIds = rawGroupIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    if (groupIds.length === 0) groupIds = undefined
  } else if (rawGroupId && rawGroupId !== "none") {
    const n = Number(rawGroupId)
    if (!isNaN(n) && n > 0) groupIds = [n]
  }

  // ロールフィルター解析
  const rawRoleIds = params.roleIds as string | undefined
  const roleUnassigned = params.roleUnassigned === "true"
  let roleIds: number[] | undefined
  if (rawRoleIds) {
    roleIds = rawRoleIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    if (roleIds.length === 0) roleIds = undefined
  }

  const session = await auth()
  const isAuthenticated = !!session?.user

  const [result, groups, roles] = await Promise.all([
    getEmployees(
      { search, groupIds, noGroup: unassigned || undefined, roleIds, roleUnassigned: roleUnassigned || undefined, activeOnly },
      { page, pageSize }
    ),
    getGroups(),
    getFunctionRoles(),
  ])

  return (
    <>
      <PageHeader
        title="従業員"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "従業員" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">従業員一覧</h1>
          <div className="flex items-center gap-2">
            {isAuthenticated && <EmployeeImportDialog />}
            <Suspense fallback={null}>
              <EmployeeExportButton />
            </Suspense>
            {isAuthenticated && <EmployeeForm groups={groups} />}
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <EmployeeFilters groups={groups} roles={roles} />
        </Suspense>
        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-2">
            {result.total}件中 {(page - 1) * pageSize + 1}〜
            {Math.min(page * pageSize, result.total)}件を表示
          </p>
          <EmployeeTable
            data={result.data}
            pageCount={result.totalPages}
            page={page}
          />
        </div>
      </PageContainer>
    </>
  )
}
