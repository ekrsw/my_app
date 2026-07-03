import { PageHeader } from "@/components/layout/page-header"
import { ROUTES } from "@/lib/routes"
import { PageContainer } from "@/components/layout/page-container"
import { SkillTable } from "@/components/skills/skill-table"
import { getSkills } from "@/lib/db/skills"
import { SkillForm } from "@/components/skills/skill-form"
import { auth } from "@/auth"

export default async function SkillsPage() {
  const session = await auth()
  const isAuthenticated = !!session?.user
  const skills = await getSkills()

  return (
    <>
      <PageHeader
        title="スキル管理"
        breadcrumbs={[
          { label: "ダッシュボード", href: ROUTES.top },
          { label: "スキル管理" },
        ]}
      />
      <PageContainer>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">スキル管理</h1>
          {isAuthenticated && <SkillForm />}
        </div>
        <SkillTable data={skills} />
      </PageContainer>
    </>
  )
}
