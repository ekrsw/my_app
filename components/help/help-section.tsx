import Link from "next/link"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import type { HelpAnchor } from "@/lib/help/sections"

const LINK_CLASS = "text-primary underline underline-offset-4 hover:no-underline"

/**
 * Markdown 本文を描画するヘルプセクション。
 *
 * react-markdown の components prop で各要素をプロジェクトのセマンティックトークンに
 * 手動マップする（@tailwindcss/typography 不使用＝新規依存なし・ダークモード無償・
 * docs/style-guide.md 完全一致）。
 *
 * 見出し階層: ページ <h1>「ヘルプ」 → セクション <h2>{title}（manifest）
 *             → 本文 .md の `##` は <h3> に1段下げて描画する。
 */
// 制御された .md のみを描画するため、各要素は必要な children（と a の href）だけを
// 受け取る。react-markdown が渡す node などは展開せず、DOM に余計な属性を漏らさない。
const markdownComponents: Components = {
  h2: ({ children }) => (
    <h3 className="mt-8 mb-2 text-base font-semibold text-foreground">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-6 mb-2 text-sm font-semibold text-foreground">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-3.5 leading-7 text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3.5 list-disc space-y-2 pl-6">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3.5 list-decimal space-y-2 pl-6">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-7 text-foreground">{children}</li>
  ),
  a: ({ href, children }) => {
    const url = href ?? "#"
    // 内部リンク（/path や #anchor）はクライアント遷移、外部リンクは安全に新規タブ
    const isInternal = url.startsWith("/") || url.startsWith("#")
    if (isInternal) {
      return (
        <Link href={url} className={LINK_CLASS}>
          {children}
        </Link>
      )
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        {children}
      </a>
    )
  },
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
      {children}
    </code>
  ),
  // ログイン注記などの注意書きを callout として描画
  blockquote: ({ children }) => (
    <div className="my-4 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground [&_p]:my-0 [&_p]:text-muted-foreground">
      {children}
    </div>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border bg-muted px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border px-3 py-2 text-left">{children}</td>
  ),
}

type HelpSectionProps = {
  anchor: HelpAnchor
  title: string
  markdown: string
}

export function HelpSection({ anchor, title, markdown }: HelpSectionProps) {
  return (
    <section id={anchor} className={cn("mb-11 scroll-mt-16")}>
      <h2 className="mb-3 border-b pb-1.5 text-xl font-semibold text-foreground">
        {title}
      </h2>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </section>
  )
}
