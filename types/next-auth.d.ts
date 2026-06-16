import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** ログイン時刻（ms, epoch）。セッション絶対期限の起点。lib/auth-session.ts 参照 */
    loginAt?: number
  }
}
