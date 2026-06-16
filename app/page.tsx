import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { ROUTES } from "@/lib/routes"

/**
 * 公開トップ（工事中）。
 * - 未認証: 「工事中」を表示（アプリ機能には到達不可。アプリは /top 配下）。
 * - ログイン済み: /top（ダッシュボード）へ転送。
 *
 * `/` は公開パス（middleware の認証ゲートを素通り）なので、ここでの
 * RSC 内転送のみが効く。ログイン済み → /top は認証済みなのでループしない。
 * サイドバー・SessionProvider は付けない（(main) レイアウトの外）。
 */
export default async function UnderConstructionPage() {
  const session = await auth()
  if (session?.user) {
    redirect(ROUTES.top)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">工事中</h1>
      <p className="text-muted-foreground">
        ただいまメンテナンス中です。しばらくお待ちください。
      </p>
    </main>
  )
}
