import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: [
    // 静的アセット（拡張子付きパス: .png/.css/.woff2/robots.txt 等）と
    // _next・favicon・/api/auth を除外。除外したパスは authorized を通らない＝
    // 未認証でも配信される（工事中ページのロゴ/画像が壊れないように）。
    "/((?!_next/static|_next/image|favicon\\.ico|api/auth|.*\\.[\\w]+$).*)",
  ],
}
