import { describe, it, expect, afterEach } from "vitest"
import { getAbsoluteTtlMs, isSessionExpired } from "@/lib/auth-session"

const ENV_KEY = "AUTH_ABSOLUTE_SESSION_SECONDS"
const DEFAULT_MS = 28800 * 1000 // 8h

describe("getAbsoluteTtlMs", () => {
  const original = process.env[ENV_KEY]
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = original
  })

  it("未設定ならデフォルト 8 時間", () => {
    delete process.env[ENV_KEY]
    expect(getAbsoluteTtlMs()).toBe(DEFAULT_MS)
  })

  it("正の整数（秒）を ms に変換", () => {
    process.env[ENV_KEY] = "2"
    expect(getAbsoluteTtlMs()).toBe(2000)
    process.env[ENV_KEY] = "3600"
    expect(getAbsoluteTtlMs()).toBe(3_600_000)
  })

  it("不正値（NaN・0・負・空）はデフォルトにフォールバック", () => {
    for (const v of ["abc", "0", "-5", ""]) {
      process.env[ENV_KEY] = v
      expect(getAbsoluteTtlMs()).toBe(DEFAULT_MS)
    }
  })
})

describe("isSessionExpired", () => {
  const ttl = 1000

  it("loginAt 欠落（移行中の既存トークン）は失効させない", () => {
    expect(isSessionExpired(undefined, 999_999, ttl)).toBe(false)
  })

  it("経過が ttl 以下なら有効（境界: ちょうど ttl は false）", () => {
    expect(isSessionExpired(1000, 1000, ttl)).toBe(false) // 経過 0
    expect(isSessionExpired(1000, 1999, ttl)).toBe(false) // 経過 999 < 1000
    expect(isSessionExpired(1000, 2000, ttl)).toBe(false) // 経過 1000 = ttl（境界）
  })

  it("経過が ttl 超過なら失効（境界の直後）", () => {
    expect(isSessionExpired(1000, 2001, ttl)).toBe(true) // 経過 1001 > 1000
    expect(isSessionExpired(0, 10_000, ttl)).toBe(true)
  })
})
