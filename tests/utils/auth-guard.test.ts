import { describe, it, expect, vi, beforeEach } from "vitest"

// requireAuth の依存をモック
const authMock = vi.fn()
const redirectMock = vi.fn()
const cookiesGetMock = vi.fn()

vi.mock("@/auth", () => ({ auth: () => authMock() }))
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => cookiesGetMock(k) }),
}))

import { requireAuth } from "@/lib/auth-guard"

describe("requireAuth", () => {
  beforeEach(() => {
    authMock.mockReset()
    redirectMock.mockReset()
    cookiesGetMock.mockReset()
  })

  it("認証済みならセッションを返し redirect しない", async () => {
    const session = { user: { id: "1", name: "admin" } }
    authMock.mockResolvedValue(session)
    const result = await requireAuth()
    expect(result).toEqual(session)
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("未認証 かつ had_session あり → /login?reason=expired へ redirect", async () => {
    authMock.mockResolvedValue(null)
    cookiesGetMock.mockReturnValue({ value: "1" }) // had_session present
    await requireAuth()
    expect(redirectMock).toHaveBeenCalledWith("/login?reason=expired")
  })

  it("未認証 かつ had_session なし（初回未認証）→ /login へ redirect（reason なし）", async () => {
    authMock.mockResolvedValue(null)
    cookiesGetMock.mockReturnValue(undefined)
    await requireAuth()
    expect(redirectMock).toHaveBeenCalledWith("/login")
  })
})
