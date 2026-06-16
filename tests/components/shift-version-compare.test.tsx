// @vitest-environment happy-dom
import { render, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

const pushMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}))
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastErrorMock(m), success: vi.fn() } }))
// server action（prisma 取り込みを避ける）
vi.mock("@/lib/actions/shift-actions", () => ({ restoreShiftVersion: vi.fn() }))

import { ShiftVersionCompare } from "@/components/shifts/shift-version-compare"
import { SESSION_EXPIRED_MESSAGE } from "@/lib/auth-session"

describe("ShiftVersionCompare の 401（失効）ハンドリング", () => {
  beforeEach(() => {
    pushMock.mockReset()
    toastErrorMock.mockReset()
    // happy-dom の location.pathname を固定
    window.history.pushState({}, "", "/top/shifts")
  })

  it("fetch が 401 を返したらクラッシュせず /login?...&reason=expired へ誘導", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "unauthorized" }) })
    )

    render(
      <ShiftVersionCompare open onOpenChange={() => {}} shiftId={123} employeeName="山田太郎" />
    )

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/login?callbackUrl=%2Ftop%2Fshifts&reason=expired"
      )
    })
    expect(toastErrorMock).toHaveBeenCalledWith(SESSION_EXPIRED_MESSAGE)
    vi.unstubAllGlobals()
  })

  it("fetch が 200・空配列なら誘導しない（正常系でクラッシュしない）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }))

    render(
      <ShiftVersionCompare open onOpenChange={() => {}} shiftId={123} employeeName="山田太郎" />
    )

    await waitFor(() => {
      expect((globalThis.fetch as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    })
    expect(pushMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it("fetch が 401 以外の失敗（500）なら汎用エラートーストで、ログイン誘導はしない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    )

    render(
      <ShiftVersionCompare open onOpenChange={() => {}} shiftId={123} employeeName="山田太郎" />
    )

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("バージョン情報の取得に失敗しました")
    })
    expect(pushMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
