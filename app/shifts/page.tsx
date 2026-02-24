import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftPageClient } from "@/components/shifts/shift-page-client"
import { getShiftsForCalendar, getShiftsTable } from "@/lib/db/shifts"
import { getGroups } from "@/lib/db/groups"
import { getActiveShiftCodes } from "@/lib/db/shift-codes"
import type { SearchParams } from "@/types"

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const now = new Date()
  const year = Number(params.year) || now.getFullYear()
  const month = Number(params.month) || now.getMonth() + 1
  const groupId = params.groupId ? Number(params.groupId) : undefined
  const search = params.search as string | undefined
  const page = Number(params.page) || 1

  const filter = { year, month, groupId, employeeSearch: search }

  const [calendarData, tableResult, groups, shiftCodes] = await Promise.all([
    getShiftsForCalendar(filter),
    getShiftsTable(filter, { page, pageSize: 20 }),
    getGroups(),
    getActiveShiftCodes(),
  ])

  return (
    <>
      <PageHeader
        title="シフト管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "シフト管理" },
        ]}
      />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">シフト管理</h1>
        <ShiftPageClient
          calendarData={calendarData}
          tableData={tableResult.data}
          tablePageCount={tableResult.totalPages}
          tablePage={page}
          groups={groups}
          year={year}
          month={month}
          shiftCodes={shiftCodes}
        />
      </PageContainer>
    </>
  )
}
