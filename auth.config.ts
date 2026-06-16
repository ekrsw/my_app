import type { NextAuthConfig } from "next-auth"
import { getAbsoluteTtlMs, isSessionExpired } from "@/lib/auth-session"

export const authConfig = {
  session: {
    strategy: "jwt",
    // 絶対期限と同値の保険。maxAge はローリングで延長されるため、絶対失効を
    // 効かせる唯一の点は下の jwt コールバックの `return null`。maxAge は失効済み
    // トークンを Cookie 側からも早めに無効化する補助でしかない。
    maxAge: getAbsoluteTtlMs() / 1000,
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // 認証ゲート（isPublic 判定・未認証リダイレクト・401・had_session）は
    // middleware.ts のラッパー（`auth((req) => ...)`）に一本化した。authorized
    // コールバックはラッパー形では使われないため、ここには置かない（二重実装回避）。
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.loginAt = Date.now() // 絶対期限の起点を記録（初回ログイン時のみ）
      }
      // ローリングに関係なく、ログインからの経過が絶対上限を超えたら
      // null を返してセッションを破棄する（真の絶対失効）。
      if (isSessionExpired(token.loginAt, Date.now(), getAbsoluteTtlMs())) {
        return null
      }
      return token
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
} satisfies NextAuthConfig
