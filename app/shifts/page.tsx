import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftPageClient } from "@/components/shifts/shift-page-client"
import { ShiftTabs } from "@/components/shifts/shift-tabs"
import { ShiftHistoryTable } from "@/components/shifts/shift-history-table"
import { TabsContent } from "@/components/ui/tabs"
import { getShiftsForCalendarPaginated, getShiftsTable } from "@/lib/db/shifts"
import { getShiftHistory } from "@/lib/db/history"
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
  const activeTab = (params.tab as string) ?? "management"

  const isHistory = activeTab === "history"

  const filter = { year, month, groupId, employeeSearch: search }

  const [calendarResult, tableResult, groups, shiftCodes, historyResult] =
    await Promise.all([
      isHistory
        ? Promise.resolve({ data: [], total: 0, hasMore: false, nextCursor: null })
        : getShiftsForCalendarPaginated(filter, { cursor: 0, pageSize: 50 }),
      isHistory
        ? Promise.resolve({ data: [], totalPages: 0 })
        : getShiftsTable(filter, { page, pageSize: 20 }),
      getGroups(),
      isHistory
        ? Promise.resolve([])
        : getActiveShiftCodes(),
      isHistory
        ? getShiftHistory({ page, pageSize: 20 })
        : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
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
        <ShiftTabs activeTab={activeTab}>
          <TabsContent value="management" className="mt-4">
            <ShiftPageClient
              initialCalendarData={calendarResult.data}
              calendarTotal={calendarResult.total}
              calendarHasMore={calendarResult.hasMore}
              calendarNextCursor={calendarResult.nextCursor}
              calendarFilter={filter}
              tableData={tableResult.data}
              tablePageCount={tableResult.totalPages}
              tablePage={page}
              groups={groups}
              year={year}
              month={month}
              shiftCodes={shiftCodes}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              {historyResult.total}件の変更履歴
            </p>
            <ShiftHistoryTable
              data={historyResult.data}
              pageCount={historyResult.totalPages}
              page={page}
            />
          </TabsContent>
        </ShiftTabs>
      </PageContainer>
    </>
  )
}
