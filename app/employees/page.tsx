import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { EmployeeTable } from "@/components/employees/employee-table"
import { EmployeeFilters } from "@/components/employees/employee-filters"
import { getEmployees } from "@/lib/db/employees"
import { getGroups } from "@/lib/db/groups"
import { EmployeeForm } from "@/components/employees/employee-form"
import { EmployeeImportDialog } from "@/components/employees/employee-import-dialog"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { SearchParams } from "@/types"

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const pageSize = Number(params.pageSize) || 20
  const search = params.search as string | undefined
  const groupId = params.groupId ? Number(params.groupId) : undefined
  const activeOnly = params.activeOnly === "true"

  const [result, groups] = await Promise.all([
    getEmployees({ search, groupId, activeOnly }, { page, pageSize }),
    getGroups(),
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
            <EmployeeImportDialog />
            <EmployeeForm groups={groups} />
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-10 w-full" />}>
          <EmployeeFilters groups={groups} />
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
