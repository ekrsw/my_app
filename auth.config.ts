import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"
import { isPublic } from "@/lib/routes"

export const authConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // 全リクエスト（matcher 対象）がここを通る認証ゲート。
    // `/` と `/login` と `/api/auth/*` のみ公開、それ以外は認証必須。
    // ページは boolean を返し、false で next-auth が /login?callbackUrl= へ
    // リダイレクトする。API は HTML リダイレクトでなく JSON 401 を返す
    // （fetch 呼び出し元が壊れないように）。
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl // pathname のみ参照・クエリ無視（ループ防止）
      if (isPublic(pathname)) return true
      const isAuthed = !!auth?.user
      if (pathname.startsWith("/api/")) {
        return isAuthed
          ? true
          : NextResponse.json({ error: "unauthorized" }, { status: 401 })
      }
      return isAuthed
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
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
