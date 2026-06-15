import Link from "next/link"
import { ROUTES } from "@/lib/routes"

/**
 * ルートの 404。`/top/存在しないパス` のような未マッチ URL はここに落ちる
 *（(main)/not-found.tsx は (main) 内で notFound() を呼んだ時のみ発火）。
 * サイドバー無しの素のページ。
 */
export default function RootNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground">
        お探しのページは存在しないか、移動された可能性があります。
      </p>
      <Link href={ROUTES.top} className="text-sm underline underline-offset-4">
        トップへ戻る
      </Link>
    </main>
  )
}
