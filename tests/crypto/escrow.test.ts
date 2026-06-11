import { describe, it, expect } from "vitest"
import { randomBytes } from "node:crypto"
import {
  buildKeyringFile,
  generateRecoveryCode,
  randomDek,
  unwrapDek,
  verifyDekCheck,
  wrapDek,
} from "@/lib/crypto/envelope"

describe("escrow（二重ラップとリカバリ）", () => {
  it("運用パスフレーズとリカバリコードの両方から同一 DEK を復元できる", () => {
    const dek = randomDek()
    const input = "op-input-12345"
    const code = generateRecoveryCode()
    const file = buildKeyringFile(dek, input, code)

    const viaOp = unwrapDek(file.op.wrappedDek, input, Buffer.from(file.op.salt, "base64url"))
    const viaRec = unwrapDek(
      file.recovery.wrappedDek,
      code,
      Buffer.from(file.recovery.salt, "base64url"),
    )
    expect(viaOp.equals(dek)).toBe(true)
    expect(viaRec.equals(dek)).toBe(true)
  })

  it("リカバリで新運用PFに再ラップ後、旧PF失敗・新PF成功・DEK不変", () => {
    const dek = randomDek()
    const code = generateRecoveryCode()
    const file = buildKeyringFile(dek, "old-input-12345", code)

    // リカバリコードで復元
    const recovered = unwrapDek(
      file.recovery.wrappedDek,
      code,
      Buffer.from(file.recovery.salt, "base64url"),
    )
    expect(verifyDekCheck(recovered, file.dekCheck)).toBe(true)

    // 新パスフレーズで op を再ラップ
    const newSalt = randomBytes(16)
    file.op = {
      salt: newSalt.toString("base64url"),
      wrappedDek: wrapDek(recovered, "new-input-67890", newSalt),
    }

    // 旧PFは失敗
    expect(() => unwrapDek(file.op.wrappedDek, "old-input-12345", newSalt)).toThrow()
    // 新PFは成功し、同一 DEK
    const viaNew = unwrapDek(file.op.wrappedDek, "new-input-67890", newSalt)
    expect(viaNew.equals(dek)).toBe(true)
    // dekCheck も依然検証可（DEK 不変）
    expect(verifyDekCheck(viaNew, file.dekCheck)).toBe(true)
  })
})
