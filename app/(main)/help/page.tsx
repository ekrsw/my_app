import Link from "next/link"
import { PageHeader } from "@/components/layout/page-header"
import { PageContainer } from "@/components/layout/page-container"
import { HelpSection } from "@/components/help/help-section"
import { HELP_SECTIONS } from "@/lib/help/sections"
import { loadHelpSection } from "@/lib/help/load-help"

/**
 * ヘルプページ（/help）。
 *
 * Server Component。auth/searchParams は使わないが、(main) レイアウトが cookies() を
 * 読むためセグメント全体が動的レンダリング（リクエスト時描画）になる。よって
 * content/help/*.md は毎リクエスト fs で読まれる（ビルド時の静的焼き込みではない）。
 * content/ はリポジトリにコミットされ実行時サーバーの cwd 直下に存在する前提。
 * 本文の更新は .md を編集してコミット・再デプロイすると反映される。
 *
 * 注: output:"standalone"（Docker等）やサーバーレスへ移行する場合、process.cwd() 経由の
 * 読み込みは Next のファイルトレースで追跡されないため、outputFileTracingIncludes 等で
 * content/help を明示的に同梱する必要がある（現状そのデプロイ構成は無い）。
 */
export default async function HelpPage() {
  // 各セクションの Markdown をビルド時に読み込む。
  // ファイル欠落時は loadHelpSection が throw し、ビルドが失敗する（fail-loud）。
  const sections = await Promise.all(
    HELP_SECTIONS.map(async (section) => ({
      ...section,
      markdown: await loadHelpSection(section.file),
    }))
  )

  return (
    <>
      <PageHeader
        title="ヘルプ"
        breadcrumbs={[{ label: "ダッシュボード", href: "/" }, { label: "ヘルプ" }]}
      />
      <PageContainer>
        <div className="mx-auto max-w-[72ch]">
          <h1 className="mb-5 text-2xl font-bold">ヘルプ</h1>

          {/* 目次（本文上にインライン配置） */}
          <nav
            aria-label="目次"
            className="mb-10 rounded-lg border bg-muted px-5 py-4"
          >
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              目次
            </h2>
            <ol className="list-decimal space-y-1.5 pl-5">
              {HELP_SECTIONS.map((section) => (
                <li key={section.anchor}>
                  <Link
                    href={`#${section.anchor}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {section.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((section) => (
            <HelpSection
              key={section.anchor}
              anchor={section.anchor}
              title={section.title}
              markdown={section.markdown}
            />
          ))}
        </div>
      </PageContainer>
    </>
  )
}
