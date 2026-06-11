import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildKeyringFile,
  generateRecoveryCode,
  randomDek,
  writeKeyringFile,
} from "@/lib/crypto/envelope"

// keyring の DEK は globalThis に保持され、複数のモジュールインスタンス間で共有される。
// Next.js は同一プロセスでも route handler 層（unlock を書く）と RSC 層（SealedBanner /
// 復号拡張が読む）で本モジュールを別インスタンスとして評価しうる。単純なモジュールスコープ
// 変数だとアンロック後も「ロック中」のままになる回帰を、vi.resetModules で別インスタンスを
// 作って検証する。

const OP_FIXTURE = "operational-test-input-123"
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "keyring-singleton-"))
  writeKeyringFile(join(dir, "keyring.json"), buildKeyringFile(randomDek(), OP_FIXTURE, generateRecoveryCode()))
  process.env.KEYRING_PATH = join(dir, "keyring.json")
  process.env.UNLOCK_TOKEN_PATH = join(dir, "unlock.token")
  vi.resetModules()
})

afterEach(async () => {
  const k = await import("@/lib/crypto/keyring")
  k.__resetForTest()
  rmSync(dir, { recursive: true, force: true })
  delete process.env.KEYRING_PATH
  delete process.env.UNLOCK_TOKEN_PATH
})

describe("keyring: globalThis でモジュールインスタンス間共有", () => {
  it("vi.resetModules 後の別インスタンスからも unlock 済みが見える", async () => {
    const k1 = await import("@/lib/crypto/keyring")
    k1.unlock(OP_FIXTURE)
    expect(k1.isUnlocked()).toBe(true)

    // route handler 層と RSC 層が別バンドルになる Next.js を模す
    vi.resetModules()
    const k2 = await import("@/lib/crypto/keyring")
    expect(k2).not.toBe(k1) // 別モジュールインスタンス
    expect(k2.isUnlocked()).toBe(true) // それでも globalThis 経由で DEK を共有
  })

  it("一方の lock() がもう一方からも反映される", async () => {
    const k1 = await import("@/lib/crypto/keyring")
    k1.unlock(OP_FIXTURE)
    vi.resetModules()
    const k2 = await import("@/lib/crypto/keyring")
    k2.lock()
    expect(k1.isUnlocked()).toBe(false)
    expect(k2.isUnlocked()).toBe(false)
  })
})
