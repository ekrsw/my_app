import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authConfig } from "@/auth.config"

// jwt コールバック（絶対失効の実際の強制点）を直接呼ぶ。
// 純関数 isSessionExpired/getAbsoluteTtlMs は別途テスト済みだが、
// 「loginAt をログイン時のみ刻印し、超過で null を返す」配線は本テストで担保する。
type JwtCb = NonNullable<NonNullable<typeof authConfig.callbacks>["jwt"]>
const jwt = authConfig.callbacks!.jwt! as JwtCb

const ENV_KEY = "AUTH_ABSOLUTE_SESSION_SECONDS"

function call(token: Record<string, unknown>, user?: Record<string, unknown>) {
  // next-auth の型に厳密一致させず、コールバックが参照する token/user のみ渡す
  return jwt({ token, user } as unknown as Parameters<JwtCb>[0])
}

describe("auth.config jwt コールバック（絶対失効の配線）", () => {
  const original = process.env[ENV_KEY]
  beforeEach(() => {
    process.env[ENV_KEY] = "3600" // ttl = 1 時間（決定的に）
  })
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = original
  })

  it("初回ログイン（user あり）で loginAt と id を刻印する", async () => {
    const before = Date.now()
    const result = (await call({}, { id: "42" })) as Record<string, unknown> | null
    expect(result).not.toBeNull()
    expect(result!.id).toBe("42")
    expect(typeof result!.loginAt).toBe("number")
    expect(result!.loginAt as number).toBeGreaterThanOrEqual(before)
  })

  it("loginAt はリフレッシュ（user なし）で再刻印されない（失効が無効化されないこと）", async () => {
    const fixedLoginAt = Date.now() - 1000 // 1 秒前
    const result = (await call({ id: "42", loginAt: fixedLoginAt })) as Record<string, unknown> | null
    expect(result).not.toBeNull()
    expect(result!.loginAt).toBe(fixedLoginAt) // 上書きされない
  })

  it("ttl 超過で null を返してセッションを破棄する", async () => {
    const stale = Date.now() - 3601 * 1000 // ttl(3600s) を 1 秒超過
    const result = await call({ id: "42", loginAt: stale })
    expect(result).toBeNull()
  })

  it("ttl 内なら token を返す", async () => {
    const fresh = Date.now() - 60 * 1000 // 1 分前
    const result = (await call({ id: "42", loginAt: fresh })) as Record<string, unknown> | null
    expect(result).not.toBeNull()
    expect(result!.id).toBe("42")
  })

  it("loginAt 欠落（移行中の既存トークン）は失効させない", async () => {
    const result = (await call({ id: "42" })) as Record<string, unknown> | null
    expect(result).not.toBeNull()
    expect(result!.id).toBe("42")
  })
})
