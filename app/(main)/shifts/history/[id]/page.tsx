import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftHistoryDetail } from "@/components/shifts/shift-history-detail"
import { getShiftHistoryById, getShiftVersions } from "@/lib/db/history"
import { auth } from "@/auth"
import { notFound } from "next/navigation"

export default async function ShiftHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const historyId = Number(id)

  if (isNaN(historyId)) {
    notFound()
  }

  const entry = await getShiftHistoryById(historyId)

  if (!entry) {
    notFound()
  }

  const [versions, session] = await Promise.all([
    getShiftVersions(entry.shiftId),
    auth(),
  ])
  const isAuthenticated = !!session?.user

  return (
    <>
      <PageHeader
        title="変更履歴詳細"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "シフト管理", href: "/shifts" },
          { label: "変更履歴", href: "/shifts?tab=history" },
          { label: `履歴 #${entry.id}` },
        ]}
      />
      <PageContainer>
        <ShiftHistoryDetail entry={entry} versions={versions} isAuthenticated={isAuthenticated} />
      </PageContainer>
    </>
  )
}
