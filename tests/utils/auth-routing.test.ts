import { describe, it, expect } from "vitest"
import { isPublic, safeCallback, ROUTES } from "@/lib/routes"
import { decideGate } from "@/lib/auth-gate"

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

describe("lib/auth-gate decideGate（認証ゲート判定）", () => {
  it("公開パスは未認証でも next（had_session 設定なし）", () => {
    expect(decideGate({ pathname: "/", isAuthed: false, hadSession: false })).toEqual({
      type: "next",
      setHadSession: false,
    })
    expect(decideGate({ pathname: "/login", isAuthed: false, hadSession: false })).toEqual({
      type: "next",
      setHadSession: false,
    })
  })

  it("認証済みページは next、had_session 未設定なら付与・既設なら付与しない", () => {
    expect(decideGate({ pathname: "/top", isAuthed: true, hadSession: false })).toEqual({
      type: "next",
      setHadSession: true,
    })
    expect(decideGate({ pathname: "/top/employees", isAuthed: true, hadSession: true })).toEqual({
      type: "next",
      setHadSession: false,
    })
  })

  it("未認証ページ・had_session なし → redirect（reason なし＝初回未認証）", () => {
    expect(decideGate({ pathname: "/top", isAuthed: false, hadSession: false })).toEqual({
      type: "redirect",
      reason: null,
    })
  })

  it("未認証ページ・had_session あり → redirect reason=expired（失効）", () => {
    expect(decideGate({ pathname: "/top/employees", isAuthed: false, hadSession: true })).toEqual({
      type: "redirect",
      reason: "expired",
    })
  })

  it("未認証 API は json401（export も認証必須、had_session の有無に依らず）", () => {
    expect(decideGate({ pathname: "/api/employees/export", isAuthed: false, hadSession: false })).toEqual({
      type: "json401",
    })
    expect(decideGate({ pathname: "/api/shifts/versions", isAuthed: false, hadSession: true })).toEqual({
      type: "json401",
    })
  })

  it("認証済み API は next", () => {
    expect(decideGate({ pathname: "/api/employees/export", isAuthed: true, hadSession: true })).toEqual({
      type: "next",
      setHadSession: false,
    })
  })

  it("never-throw: 不正な pathname でも例外を投げない", () => {
    for (const p of ["", "//", "/\\x", "/top/"]) {
      expect(() => decideGate({ pathname: p, isAuthed: false, hadSession: false })).not.toThrow()
    }
  })
})
