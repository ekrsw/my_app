import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftHistoryTable } from "@/components/shifts/shift-history-table"
import { getShiftHistory } from "@/lib/db/history"
import type { SearchParams } from "@/types"

export default async function ShiftHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const page = Number(params.page) || 1

  const result = await getShiftHistory({ page, pageSize: 20 })

  return (
    <>
      <PageHeader
        title="シフト変更履歴"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "シフト管理", href: "/shifts" },
          { label: "変更履歴" },
        ]}
      />
      <PageContainer>
        <h1 className="text-2xl font-bold mb-4">シフト変更履歴</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {result.total}件の変更履歴
        </p>
        <ShiftHistoryTable
          data={result.data}
          pageCount={result.totalPages}
          page={page}
        />
      </PageContainer>
    </>
  )
}
