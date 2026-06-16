import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "./auth.config"
import { ROUTES } from "@/lib/routes"
import { HAD_SESSION_COOKIE, HAD_SESSION_MAX_AGE } from "@/lib/auth-session"
import { decideGate } from "@/lib/auth-gate"

const { auth } = NextAuth(authConfig)

// 認証ゲートの単一ソース（ラッパー形）。matcher 対象の全リクエストがここを通る。
// 判定本体は純関数 decideGate（lib/auth-gate.ts）に集約し、ここは NextResponse への
// 変換のみ。失効（had_session あり）と初回未認証（なし）を reason=expired で出し分ける。
export default auth((req) => {
  const { nextUrl } = req
  const { pathname } = nextUrl

  const decision = decideGate({
    pathname,
    isAuthed: !!req.auth?.user,
    hadSession: !!req.cookies.get(HAD_SESSION_COOKIE),
  })

  switch (decision.type) {
    case "next": {
      const res = NextResponse.next()
      // 失効後に「未認証 かつ had_session あり = 失効」と判定できるよう痕跡を残す。
      if (decision.setHadSession) {
        res.cookies.set(HAD_SESSION_COOKIE, "1", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production", // Auth.js のセッション cookie と同様に本番では Secure
          sameSite: "lax",
          path: "/",
          maxAge: HAD_SESSION_MAX_AGE,
        })
      }
      return res
    }
    case "json401":
      // 未認証 API は HTML リダイレクトでなく JSON 401（fetch 呼び出し元が壊れないように）。
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    case "redirect": {
      const url = new URL(ROUTES.login, nextUrl)
      url.searchParams.set("callbackUrl", pathname) // pathname のみ（login 側 safeCallback で再検証）
      if (decision.reason === "expired") url.searchParams.set("reason", "expired")
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    // 静的アセット（拡張子付きパス: .png/.css/.woff2/robots.txt 等）と
    // _next・favicon・/api/auth を除外。除外したパスは認証ゲート（auth ラッパー /
    // decideGate）を通らない＝未認証でも配信される（工事中ページのロゴ/画像が壊れないように）。
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|.*\\.[\\w]+$).*)",
  ],
}
