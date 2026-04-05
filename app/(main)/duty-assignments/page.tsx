import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { DutyAssignmentTable } from "@/components/duty-assignments/duty-assignment-table"
import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"
import { DutyAssignmentFilters } from "@/components/duty-assignments/duty-assignment-filters"
import { getDutyAssignmentsByDate } from "@/lib/db/duty-assignments"
import { getActiveDutyTypes } from "@/lib/db/duty-types"
import { getAllEmployees } from "@/lib/db/employees"
import { getTodayJST } from "@/lib/date-utils"
import { auth } from "@/auth"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function DutyAssignmentsPage({ searchParams }: Props) {
  const params = await searchParams
  const dateStr = typeof params.date === "string" ? params.date : null

  const filterDate = dateStr ? new Date(dateStr) : null
  const defaultDateStr = dateStr || ""

  const session = await auth()
  const isAuthenticated = !!session?.user

  const today = getTodayJST()
  const todayStr = today.toISOString().substring(0, 10)

  const [assignments, dutyTypes, employees] = await Promise.all([
    getDutyAssignmentsByDate(filterDate),
    getActiveDutyTypes(),
    getAllEmployees(),
  ])

  const employeeOptions = employees.map((e) => ({ id: e.id, name: e.name }))
  const dutyTypeOptions = dutyTypes.map((dt) => ({ id: dt.id, code: dt.code, name: dt.name, defaultReducesCapacity: dt.defaultReducesCapacity }))

  return (
    <>
      <PageHeader
        title="業務管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "業務管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">業務管理</h1>
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <DutyAssignmentForm
                employees={employeeOptions}
                dutyTypes={dutyTypeOptions}
                defaultDate={defaultDateStr || todayStr}
              />
            )}
          </div>
        </div>
        <DutyAssignmentFilters defaultDate={defaultDateStr} todayDate={todayStr} />
        <DutyAssignmentTable
          data={assignments}
          employees={employeeOptions}
          dutyTypes={dutyTypeOptions}
          defaultDate={defaultDateStr || todayStr}
        />
      </PageContainer>
    </>
  )
}
