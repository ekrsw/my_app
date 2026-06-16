"use server"

import { cookies } from "next/headers"
import { HAD_SESSION_COOKIE } from "@/lib/auth-session"

/**
 * ログアウト時に had_session 痕跡 cookie をクリアする。
 *
 * had_session は httpOnly のためクライアント JS からは消せない。これを消さないと、
 * ログアウト後に保護ルートへアクセスした際「未認証 かつ had_session あり = 失効」と
 * 誤判定され、ログイン画面に「有効期限が切れました」が誤表示される。
 * クライアントの signOut と合わせて呼ぶこと（components/layout/app-sidebar.tsx）。
 */
export async function clearHadSession() {
  // middleware は path:"/" で set するため、削除も path を明示して確実に一致させる
  // （bare delete だと path 不一致で消えず、再ログイン画面に expired が誤表示されうる）。
  ;(await cookies()).delete({ name: HAD_SESSION_COOKIE, path: "/" })
}
