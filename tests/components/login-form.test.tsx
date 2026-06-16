// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// next/navigation — useSearchParams を可変にして reason=expired を切り替える
const searchParamsMock = vi.fn(() => new URLSearchParams())
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParamsMock(),
}))

// next-auth/react signIn（フォーム描画のみ検証するので呼ばれない）
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }))

import { LoginForm } from "@/components/auth/login-form"
import { SESSION_EXPIRED_MESSAGE as EXPIRED_MSG } from "@/lib/auth-session"

describe("LoginForm の失効メッセージ", () => {
  beforeEach(() => {
    searchParamsMock.mockReset()
  })

  it("reason=expired のとき失効メッセージを表示", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("reason=expired"))
    render(<LoginForm />)
    expect(screen.getByText(EXPIRED_MSG)).toBeTruthy()
  })

  it("reason なし（初回未認証）ではメッセージを表示しない", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams())
    render(<LoginForm />)
    expect(screen.queryByText(EXPIRED_MSG)).toBeNull()
  })

  it("callbackUrl のみ（reason 以外のクエリ）ではメッセージを表示しない", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("callbackUrl=/top/employees"))
    render(<LoginForm />)
    expect(screen.queryByText(EXPIRED_MSG)).toBeNull()
  })
})
