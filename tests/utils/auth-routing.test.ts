import { describe, it, expect } from "vitest"
import { isPublic, safeCallback, ROUTES } from "@/lib/routes"
import { authConfig } from "@/auth.config"

// authorized コールバックを直接呼ぶためのヘルパー。
// 実体は middleware（Edge）で動くが、ロジックは純粋なので nextUrl をモックして検証できる。
type AuthorizedArg = Parameters<NonNullable<typeof authConfig.callbacks>["authorized"]>[0]
function callAuthorized(pathname: string, authed: boolean) {
  const arg = {
    auth: authed ? { user: { id: "1", name: "admin" } } : null,
    request: { nextUrl: { pathname } },
  } as unknown as AuthorizedArg
  return authConfig.callbacks!.authorized!(arg)
}

describe("lib/routes isPublic", () => {
  it("/ と /login は公開", () => {
    expect(isPublic("/")).toBe(true)
    expect(isPublic("/login")).toBe(true)
  })

  it("/api/auth/* は公開（多層防御）", () => {
    expect(isPublic("/api/auth")).toBe(true)
    expect(isPublic("/api/auth/callback/credentials")).toBe(true)
  })

  it("/top・/top/* と /api/* は非公開", () => {
    expect(isPublic("/top")).toBe(false)
    expect(isPublic("/top/employees")).toBe(false)
    expect(isPublic("/api/employees/export")).toBe(false)
  })

  it("/login はクエリを含む文字列とは別物（pathname のみ判定する前提）", () => {
    // isPublic 自体は pathname を受け取る純関数。クエリ付き文字列は一致しない。
    expect(isPublic("/login?callbackUrl=/top/employees")).toBe(false)
  })

  it("never-throw: 空文字・//・不正・末尾スラッシュでも例外を投げない", () => {
    for (const p of ["", "//", "/\\evil", "///", "/top/", "/不正な値", "/api/", "/login/"]) {
      expect(() => isPublic(p)).not.toThrow()
      expect(typeof isPublic(p)).toBe("boolean")
    }
  })
})

describe("lib/routes safeCallback (オープンリダイレクト防止)", () => {
  it("同一オリジン相対パスは通す", () => {
    expect(safeCallback("/top/employees")).toBe("/top/employees")
    expect(safeCallback("/top")).toBe("/top")
  })

  it("外部 URL・プロトコル相対・バックスラッシュは /top にフォールバック", () => {
    expect(safeCallback("https://evil.com")).toBe(ROUTES.top)
    expect(safeCallback("//evil.com")).toBe(ROUTES.top)
    expect(safeCallback("/\\evil.com")).toBe(ROUTES.top)
    expect(safeCallback("http://evil")).toBe(ROUTES.top)
  })

  it("null/undefined/空は /top にフォールバック", () => {
    expect(safeCallback(null)).toBe(ROUTES.top)
    expect(safeCallback(undefined)).toBe(ROUTES.top)
    expect(safeCallback("")).toBe(ROUTES.top)
  })
})

describe("auth.config authorized（認証ゲート）", () => {
  it("公開パスは未認証でも true", () => {
    expect(callAuthorized("/", false)).toBe(true)
    expect(callAuthorized("/login", false)).toBe(true)
  })

  it("ページは未認証で false（→ /login へリダイレクトされる）", () => {
    expect(callAuthorized("/top", false)).toBe(false)
    expect(callAuthorized("/top/employees", false)).toBe(false)
  })

  it("ページは認証済みで true", () => {
    expect(callAuthorized("/top", true)).toBe(true)
    expect(callAuthorized("/top/shifts/history", true)).toBe(true)
  })

  it("/api/* は未認証で 401 (NextResponse) を返す（export も認証必須）", () => {
    const res = callAuthorized("/api/employees/export", false)
    expect(typeof res).toBe("object")
    expect((res as Response).status).toBe(401)
  })

  it("/api/* は認証済みで true", () => {
    expect(callAuthorized("/api/employees/export", true)).toBe(true)
    expect(callAuthorized("/api/shifts/versions", true)).toBe(true)
  })

  it("never-throw: 不正な pathname でも例外を投げない", () => {
    for (const p of ["", "//", "/\\x", "/top/"]) {
      expect(() => callAuthorized(p, false)).not.toThrow()
    }
  })
})
