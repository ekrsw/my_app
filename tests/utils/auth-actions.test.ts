import { describe, it, expect, vi, beforeEach } from "vitest"

const deleteMock = vi.fn()
vi.mock("next/headers", () => ({
  cookies: async () => ({ delete: (k: string) => deleteMock(k) }),
}))

import { clearHadSession } from "@/lib/actions/auth-actions"
import { HAD_SESSION_COOKIE } from "@/lib/auth-session"

describe("clearHadSession", () => {
  beforeEach(() => deleteMock.mockReset())

  it("had_session cookie を path 明示で削除する（signOut 後の expired 誤表示を防ぐ）", async () => {
    await clearHadSession()
    // set 時の path:"/" と一致させるため、削除も {name, path} で呼ぶ
    expect(deleteMock).toHaveBeenCalledWith({ name: HAD_SESSION_COOKIE, path: "/" })
    expect(deleteMock).toHaveBeenCalledTimes(1)
  })
})
