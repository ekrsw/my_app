import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { ROUTES } from "@/lib/routes"
import { HAD_SESSION_COOKIE } from "@/lib/auth-session"

/**
 * 認証必須の Server Action / Server Component の先頭で呼ぶガード。
 *
 * 未認証時は throw せず `/login` へ redirect する。これにより、セッション絶対期限が
 * 切れた状態で Server Action を叩いても汎用エラー境界に落ちず、クリーンにログインへ
 * 遷移する。失効（had_session あり）と初回未認証（なし）を reason=expired で
 * 出し分ける（middleware と同じ意味論）。
 */
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    const hadSession = (await cookies()).get(HAD_SESSION_COOKIE)
    redirect(hadSession ? `${ROUTES.login}?reason=expired` : ROUTES.login)
  }
  return session
}
