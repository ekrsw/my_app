// アプリレベル暗号化の純粋な暗号プリミティブ（状態を持たない）。
//
// 構成（Envelope 暗号）:
//   passphrase ──scrypt(+salt)──▶ KEK ──unwrap──▶ DEK ──▶ 値を AES-256-GCM 暗号化
//
// - 値・DEK ともに同じ AES-256-GCM 形式 `v1:<iv>.<tag>.<ct>`（base64url）で格納。
// - keyring.json には DEK を「運用パスフレーズ」「リカバリコード」の2鍵でラップして保存。
//   平文 DEK は一切ディスクに書かない。
// - node:crypto のみ使用（新規依存ゼロ）。

import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

const VERSION_PREFIX = "v1"
const IV_BYTES = 12
const TAG_BYTES = 16
const DEK_BYTES = 32
const SALT_BYTES = 16
const KEY_BYTES = 32 // AES-256
const SCRYPT = { N: 131072, r: 8, p: 1 } as const
// scrypt のメモリは概ね 128 * N * r ≈ 128MB。既定(32MB)では超過例外になるため上げる。
const SCRYPT_MAXMEM = 256 * 1024 * 1024
// dekCheck 用の既知平文（秘密ではない・16バイトの全ゼロ）。文字列リテラルを
// 使わないことで、シークレットスキャナの誤検知を避ける。
const DEK_CHECK_BYTES = 16

export interface KeyringFile {
  version: 1
  kdf: "scrypt"
  scrypt: { N: number; r: number; p: number }
  op: { salt: string; wrappedDek: string }
  recovery: { salt: string; wrappedDek: string }
  dekCheck: string
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url")
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url")
}

/** パスフレーズ + salt から 32バイトの KEK を導出（scrypt, N=2^17）。 */
export function deriveKek(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase.normalize("NFKC"), salt, KEY_BYTES, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT_MAXMEM,
  })
}

/** AES-256-GCM で暗号化し `v1:<iv>.<tag>.<ct>` 形式の文字列を返す。 */
export function encryptWithKey(key: Buffer, plaintext: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${VERSION_PREFIX}:${b64url(iv)}.${b64url(tag)}.${b64url(ct)}`
}

/** `v1:` 形式を復号。改竄（GCM 認証失敗）・不正形式は throw する。 */
export function decryptWithKey(key: Buffer, token: string): Buffer {
  const colon = token.indexOf(":")
  if (colon < 0 || token.slice(0, colon) !== VERSION_PREFIX) {
    throw new Error("Invalid ciphertext format")
  }
  const segs = token.slice(colon + 1).split(".")
  if (segs.length !== 3) throw new Error("Invalid ciphertext format")
  const iv = fromB64url(segs[0])
  const tag = fromB64url(segs[1])
  const ct = fromB64url(segs[2])
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Invalid ciphertext format")
  }
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

/** 32バイト乱数の DEK を生成。 */
export function randomDek(): Buffer {
  return randomBytes(DEK_BYTES)
}

/** 高エントロピーのリカバリコード（32バイト乱数の base64url）を生成。 */
export function generateRecoveryCode(): string {
  return b64url(randomBytes(32))
}

/** DEK をパスフレーズ由来の KEK でラップ（暗号化）する。 */
export function wrapDek(dek: Buffer, passphrase: string, salt: Buffer): string {
  return encryptWithKey(deriveKek(passphrase, salt), dek)
}

/** ラップされた DEK をパスフレーズで復元する。誤パスフレーズは throw。 */
export function unwrapDek(wrappedDek: string, passphrase: string, salt: Buffer): Buffer {
  return decryptWithKey(deriveKek(passphrase, salt), wrappedDek)
}

/** DEK を運用パスフレーズ・リカバリコードの2鍵でラップした keyring.json を構築する。 */
export function buildKeyringFile(
  dek: Buffer,
  opPassphrase: string,
  recoveryCode: string,
): KeyringFile {
  const opSalt = randomBytes(SALT_BYTES)
  const recSalt = randomBytes(SALT_BYTES)
  return {
    version: 1,
    kdf: "scrypt",
    scrypt: { ...SCRYPT },
    op: { salt: b64url(opSalt), wrappedDek: wrapDek(dek, opPassphrase, opSalt) },
    recovery: { salt: b64url(recSalt), wrappedDek: wrapDek(dek, recoveryCode, recSalt) },
    dekCheck: encryptWithKey(dek, Buffer.alloc(DEK_CHECK_BYTES)),
  }
}

/** dekCheck を復号して既知平文（全ゼロ）に一致するか検証（アンラップ成否の確認用）。 */
export function verifyDekCheck(dek: Buffer, dekCheck: string): boolean {
  try {
    const pt = decryptWithKey(dek, dekCheck)
    const expected = Buffer.alloc(DEK_CHECK_BYTES)
    return pt.length === expected.length && timingSafeEqual(pt, expected)
  } catch {
    return false
  }
}

export function readKeyringFile(path: string): KeyringFile {
  return JSON.parse(readFileSync(path, "utf8")) as KeyringFile
}

export function writeKeyringFile(path: string, file: KeyringFile): void {
  mkdirSync(dirname(path), { recursive: true })
  // mode 0o600 は POSIX のみ有効。Windows(NTFS)では無視されるため、本番では
  // secrets/ フォルダの NTFS ACL（管理者限定）でアクセス制御すること。
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n", { encoding: "utf8", mode: 0o600 })
}
