import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { EmployeeDetailCard } from "@/components/employees/employee-detail-card"
import { EmployeeShiftsTab } from "@/components/employees/employee-shifts-tab"
import { EmployeeRolesTab } from "@/components/employees/employee-roles-tab"
import { EmployeeHistoryTab } from "@/components/employees/employee-history-tab"
import { getEmployeeById } from "@/lib/db/employees"
import { getGroups } from "@/lib/db/groups"
import { EmployeeForm, EmployeeDeleteButton } from "@/components/employees/employee-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [employee, groups] = await Promise.all([
    getEmployeeById(Number(id)),
    getGroups(),
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
          <EmployeeForm groups={groups} employee={employee} />
          <EmployeeDeleteButton id={employee.id} />
        </div>
        <EmployeeDetailCard employee={employee} />

        <Tabs defaultValue="shifts" className="mt-6">
          <TabsList>
            <TabsTrigger value="shifts">シフト</TabsTrigger>
            <TabsTrigger value="roles">役割</TabsTrigger>
            <TabsTrigger value="history">氏名履歴</TabsTrigger>
          </TabsList>
          <TabsContent value="shifts" className="mt-4">
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <EmployeeShiftsTab employeeId={employee.id} />
            </Suspense>
          </TabsContent>
          <TabsContent value="roles" className="mt-4">
            <EmployeeRolesTab employee={employee} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <EmployeeHistoryTab employee={employee} />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </>
  )
}
