import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { ShiftCodeTable } from "@/components/shift-codes/shift-code-table"
import { getShiftCodes } from "@/lib/db/shift-codes"
import { ShiftCodeForm } from "@/components/shift-codes/shift-code-form"

export default async function ShiftCodesPage() {
  const shiftCodes = await getShiftCodes()

  return (
    <>
      <PageHeader
        title="シフトコード管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "シフトコード管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">シフトコード管理</h1>
          <ShiftCodeForm />
        </div>
        <ShiftCodeTable data={shiftCodes} />
      </PageContainer>
    </>
  )
}
