import { describe, it, expect } from "vitest"
import { randomBytes } from "node:crypto"
import {
  buildKeyringFile,
  decryptWithKey,
  encryptWithKey,
  generateRecoveryCode,
  randomDek,
  unwrapDek,
  verifyDekCheck,
  wrapDek,
} from "@/lib/crypto/envelope"

describe("envelope: encryptWithKey / decryptWithKey", () => {
  const key = randomBytes(32)

  it("暗号化→復号でラウンドトリップする", () => {
    const ct = encryptWithKey(key, Buffer.from("田中太郎", "utf8"))
    expect(decryptWithKey(key, ct).toString("utf8")).toBe("田中太郎")
  })

  it("v1: 接頭辞付きトークンを生成する", () => {
    expect(encryptWithKey(key, Buffer.from("x")).startsWith("v1:")).toBe(true)
  })

  it("同一平文でも IV 乱数性により暗号文が異なる", () => {
    expect(encryptWithKey(key, Buffer.from("same"))).not.toBe(
      encryptWithKey(key, Buffer.from("same")),
    )
  })

  it("暗号文を改竄すると復号で throw（GCM 認証失敗）", () => {
    const ct = encryptWithKey(key, Buffer.from("plaintext"))
    const segs = ct.slice(3).split(".")
    const ctBuf = Buffer.from(segs[2], "base64url")
    ctBuf[0] ^= 0xff
    const tampered = `v1:${segs[0]}.${segs[1]}.${ctBuf.toString("base64url")}`
    expect(() => decryptWithKey(key, tampered)).toThrow()
  })

  it("不正な形式は throw する", () => {
    expect(() => decryptWithKey(key, "v2:a.b.c")).toThrow()
    expect(() => decryptWithKey(key, "not-a-token")).toThrow()
  })

  it("誤った鍵では復号できない", () => {
    const ct = encryptWithKey(key, Buffer.from("x"))
    expect(() => decryptWithKey(randomBytes(32), ct)).toThrow()
  })
})

describe("envelope: wrap/unwrap と keyring ファイル", () => {
  it("wrapDek/unwrapDek がラウンドトリップし、誤パスフレーズを拒否する", () => {
    const dek = randomDek()
    const salt = randomBytes(16)
    const wrapped = wrapDek(dek, "correct horse battery", salt)
    expect(unwrapDek(wrapped, "correct horse battery", salt).equals(dek)).toBe(true)
    expect(() => unwrapDek(wrapped, "wrong", salt)).toThrow()
  })

  it("buildKeyringFile は平文 DEK を含まず、dekCheck が検証できる", () => {
    const dek = randomDek()
    const file = buildKeyringFile(dek, "op-test-input-123", generateRecoveryCode())
    const json = JSON.stringify(file)
    expect(json).not.toContain(dek.toString("base64url"))
    expect(json).not.toContain(dek.toString("hex"))
    expect(verifyDekCheck(dek, file.dekCheck)).toBe(true)
    expect(verifyDekCheck(randomDek(), file.dekCheck)).toBe(false)
  })

  it("generateRecoveryCode は高エントロピーの base64url を返す", () => {
    const code = generateRecoveryCode()
    expect(code.length).toBeGreaterThanOrEqual(43)
    expect(code).not.toMatch(/[^A-Za-z0-9_-]/)
  })
})
