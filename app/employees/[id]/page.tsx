import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { EmployeeDetailCard } from "@/components/employees/employee-detail-card"
import { EmployeeEditDialog } from "@/components/employees/employee-edit-dialog"
import { EmployeeDeleteButton } from "@/components/employees/employee-form"
import { EmployeeGroupHistorySection } from "@/components/employees/employee-group-history-section"
import { EmployeeRoleHistorySection } from "@/components/employees/employee-role-history-section"
import { EmployeePositionHistorySection } from "@/components/employees/employee-position-history-section"
import { getEmployeeById } from "@/lib/db/employees"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"
import { getActivePositions } from "@/lib/db/positions"
import { notFound } from "next/navigation"

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [employee, groups, allRoles, allPositions] = await Promise.all([
    getEmployeeById(id),
    getGroups(),
    getFunctionRoles(),
    getActivePositions(),
  ])

  if (!employee) {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={employee.name}
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "従業員", href: "/employees" },
          { label: employee.name },
        ]}
      />
      <PageContainer>
        <div className="flex items-center gap-2 mb-4">
          <EmployeeEditDialog
            employee={employee}
            groups={groups}
            allRoles={allRoles}
            allPositions={allPositions}
          />
          <EmployeeDeleteButton id={employee.id} />
        </div>
        <EmployeeDetailCard employee={employee} />

        <div className="mt-6 space-y-3">
          <EmployeeGroupHistorySection groupHistory={employee.groupHistory} />
          <EmployeeRoleHistorySection roleHistory={employee.roleHistory} />
          <EmployeePositionHistorySection positionHistory={employee.positionHistory} />
        </div>
      </PageContainer>
    </>
  )
}
