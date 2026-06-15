import Link from "next/link"
import { CircleHelp } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { helpAnchor } from "@/lib/routes"
import type { HelpAnchor } from "@/lib/help/sections"

/**
 * 各画面の PageHeader.actions に置く「?」深リンク。
 * /help#<anchor> へ遷移する。anchor は HelpAnchor 型なのでタイプミスはコンパイルエラー。
 *
 * アイコン + Link のみで対話処理を持たないため Server Component（"use client" 不要）。
 */
export function HelpLink({ anchor }: { anchor: HelpAnchor }) {
  return (
    <Link
      href={helpAnchor(anchor)}
      aria-label="ヘルプ"
      title="ヘルプ"
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
    >
      <CircleHelp className="h-4 w-4" />
    </Link>
  )
}
