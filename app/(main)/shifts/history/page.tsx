import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftHistoryTable } from "@/components/shifts/shift-history-table"
import { ShiftHistoryFilters } from "@/components/shifts/shift-history-filters"
import { getShiftHistory } from "@/lib/db/history"
import { HelpLink } from "@/components/help/help-link"
import type { SearchParams } from "@/types"

export default async function ShiftHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const page = Number(params.page) || 1
  const historyDate = params.historyDate as string | undefined
  const historyEmployee = params.historyEmployee as string | undefined

  const historyResult = await getShiftHistory(
    { page, pageSize: 20 },
    {
      ...(historyDate && { shiftDate: historyDate }),
      ...(historyEmployee && { employeeName: historyEmployee }),
    }
  )

  return (
    <>
      <PageHeader
        title="シフト変更履歴"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "シフト変更履歴" },
        ]}
        actions={<HelpLink anchor="history" />}
      />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">シフト変更履歴</h1>
        <ShiftHistoryFilters />
        <p className="text-sm text-muted-foreground mb-4">
          {historyResult.total}件の変更履歴
        </p>
        <ShiftHistoryTable
          data={historyResult.data}
          pageCount={historyResult.totalPages}
          page={page}
        />
      </PageContainer>
    </>
  )
}
