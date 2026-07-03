import { PageHeader } from "@/components/layout/page-header"
import { ROUTES } from "@/lib/routes"
import { PageContainer } from "@/components/layout/page-container"
import { EmployeeDetailTabs } from "@/components/employees/employee-detail-tabs"
import { getEmployeeById } from "@/lib/db/employees"
import { getGroups } from "@/lib/db/groups"
import { getFunctionRoles } from "@/lib/db/roles"
import { getActivePositions } from "@/lib/db/positions"
import { getActiveSkills, getEmployeeCurrentSkills, getEmployeeSkillRows } from "@/lib/db/skills"
import { notFound } from "next/navigation"
import { auth } from "@/auth"

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await auth()
  const isAuthenticated = !!session?.user

  const [employee, groups, allRoles, allPositions, allSkills, currentSkills, skillRows] =
    await Promise.all([
      getEmployeeById(id),
      getGroups(),
      getFunctionRoles(),
      getActivePositions(),
      getActiveSkills(),
      getEmployeeCurrentSkills(id),
      getEmployeeSkillRows(id),
    ])

  if (!employee) {
    notFound()
  }

  return (
    <>
      <PageHeader
        title={employee.name}
        breadcrumbs={[
          { label: "ダッシュボード", href: ROUTES.top },
          { label: "従業員", href: ROUTES.employees },
          { label: employee.name },
        ]}
      />
      <PageContainer>
        <EmployeeDetailTabs
          employee={employee}
          groups={groups}
          allRoles={allRoles}
          allPositions={allPositions}
          allSkills={allSkills}
          currentSkills={currentSkills}
          skillRows={skillRows}
          isAuthenticated={isAuthenticated}
        />
      </PageContainer>
    </>
  )
}
