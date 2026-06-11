import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { DutyTypeTable } from "@/components/duty-types/duty-type-table"
import { DutyTypeForm } from "@/components/duty-types/duty-type-form"
import { getDutyTypes } from "@/lib/db/duty-types"
import { HelpLink } from "@/components/help/help-link"
import { SealedNotice } from "@/components/crypto/sealed-notice"
import { isKeyringSealedError } from "@/lib/crypto/errors"
import { auth } from "@/auth"

export default async function DutyTypesPage() {
  const session = await auth()
  const isAuthenticated = !!session?.user

  let dutyTypes: Awaited<ReturnType<typeof getDutyTypes>>
  try {
    dutyTypes = await getDutyTypes()
  } catch (e) {
    if (isKeyringSealedError(e)) {
      return (
        <>
          <PageHeader
            title="業務種別管理"
            breadcrumbs={[
              { label: "ダッシュボード", href: "/" },
              { label: "業務種別管理" },
            ]}
            actions={<HelpLink anchor="duty-types" />}
          />
          <PageContainer>
            <SealedNotice description="業務種別の既定メモ・タイトルは暗号化されています。表示するには管理者によるアンロックが必要です。" />
          </PageContainer>
        </>
      )
    }
    throw e
  }

  return (
    <>
      <PageHeader
        title="業務種別管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: "/" },
          { label: "業務種別管理" },
        ]}
        actions={<HelpLink anchor="duty-types" />}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">業務種別管理</h1>
          <div className="flex items-center gap-2">
            {isAuthenticated && <DutyTypeForm />}
          </div>
        </div>
        <DutyTypeTable data={dutyTypes} />
      </PageContainer>
    </>
  )
}
