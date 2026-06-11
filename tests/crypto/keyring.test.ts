import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildKeyringFile,
  generateRecoveryCode,
  randomDek,
  writeKeyringFile,
} from "@/lib/crypto/envelope"
import * as keyring from "@/lib/crypto/keyring"
import { KeyringSealedError, KeyringUnlockError } from "@/lib/crypto/errors"

const PASS = "operational-passphrase-123"
let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "keyring-"))
  const path = join(dir, "keyring.json")
  writeKeyringFile(path, buildKeyringFile(randomDek(), PASS, generateRecoveryCode()))
  process.env.KEYRING_PATH = path
  process.env.UNLOCK_TOKEN_PATH = join(dir, "unlock.token")
  keyring.__resetForTest()
})

afterEach(() => {
  keyring.__resetForTest()
  rmSync(dir, { recursive: true, force: true })
  delete process.env.KEYRING_PATH
  delete process.env.UNLOCK_TOKEN_PATH
})

describe("keyring: sealed 状態", () => {
  it("起動直後は sealed", () => {
    expect(keyring.isUnlocked()).toBe(false)
  })

  it("sealed 中の encrypt/decrypt は KeyringSealedError を throw", () => {
    expect(() => keyring.encrypt("x")).toThrow(KeyringSealedError)
    expect(() => keyring.decrypt("v1:a.b.c")).toThrow(KeyringSealedError)
  })
})

describe("keyring: unlock", () => {
  it("正しい運用パスフレーズで ready になり、暗号往復する", () => {
    keyring.unlock(PASS)
    expect(keyring.isUnlocked()).toBe(true)
    const ct = keyring.encrypt("田中太郎")
    expect(keyring.decrypt(ct)).toBe("田中太郎")
  })

  it("unlock 後も同一平文は異なる暗号文になる", () => {
    keyring.unlock(PASS)
    expect(keyring.encrypt("same")).not.toBe(keyring.encrypt("same"))
  })

  it("誤った運用パスフレーズは throw し、sealed のまま", () => {
    expect(() => keyring.unlock("wrong-passphrase")).toThrow(KeyringUnlockError)
    expect(keyring.isUnlocked()).toBe(false)
  })

  it("lock() で再 sealed する", () => {
    keyring.unlock(PASS)
    keyring.lock()
    expect(keyring.isUnlocked()).toBe(false)
  })
})
