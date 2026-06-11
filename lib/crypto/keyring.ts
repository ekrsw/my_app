// keyring: DEK をプロセスメモリにのみ保持するシングルトン（方式B）。
//
// 起動直後は sealed（DEK 未ロード）。運用者が unlock(passphrase) で
// keyring.json から DEK を復元してメモリに載せる。DEK はディスクに書かない。
//
// 重要: middleware/edge ランタイムからは import しない（別プロセスで鍵が無い）。
// 利用する route には `export const runtime = "nodejs"` を付けること。

import { randomBytes, timingSafeEqual } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import {
  decryptWithKey,
  encryptWithKey,
  readKeyringFile,
  unwrapDek,
  verifyDekCheck,
} from "./envelope"
import { KeyringSealedError, KeyringUnlockError } from "./errors"

// メモリのみ保持。プロセス生存中はリクエストをまたいで保持される（next start 単一プロセス前提）。
let dek: Buffer | null = null
let unlockToken: string | null = null

function keyringPath(): string {
  return resolve(process.cwd(), process.env.KEYRING_PATH ?? "secrets/keyring.json")
}

function tokenPath(): string {
  return resolve(process.cwd(), process.env.UNLOCK_TOKEN_PATH ?? "secrets/unlock.token")
}

/** 鍵がメモリに載っているか（= 暗号操作が可能か）。 */
export function isUnlocked(): boolean {
  return dek !== null
}

/**
 * 運用パスフレーズで DEK を復元し、メモリに載せる。
 * パスフレーズ誤り・鍵検証失敗時は KeyringUnlockError を throw し、状態は sealed のまま。
 */
export function unlock(passphrase: string): void {
  const file = readKeyringFile(keyringPath())
  let candidate: Buffer
  try {
    candidate = unwrapDek(file.op.wrappedDek, passphrase, Buffer.from(file.op.salt, "base64url"))
  } catch {
    throw new KeyringUnlockError("パスフレーズが正しくありません")
  }
  if (!verifyDekCheck(candidate, file.dekCheck)) {
    throw new KeyringUnlockError("鍵の検証に失敗しました")
  }
  dek = candidate
}

/** メモリ上の DEK を消去して sealed に戻す。 */
export function lock(): void {
  if (dek) dek.fill(0)
  dek = null
}

/** 平文を暗号化。sealed 中は KeyringSealedError を throw（暗号文や null を返さない）。 */
export function encrypt(plaintext: string): string {
  if (!dek) throw new KeyringSealedError()
  return encryptWithKey(dek, Buffer.from(plaintext, "utf8"))
}

/** 暗号文を復号。sealed 中は KeyringSealedError を throw。 */
export function decrypt(token: string): string {
  if (!dek) throw new KeyringSealedError()
  return decryptWithKey(dek, token).toString("utf8")
}

/**
 * unlock エンドポイント用のローカル token を取得（無ければ生成してファイルに書く）。
 * token は鍵素材ではなく「同一マシン上でアンロックを試行する権利」を表すだけ。
 * ローカル CLI はこのファイルを読んで unlock リクエストに添える。
 */
export function getOrCreateUnlockToken(): string {
  if (unlockToken) return unlockToken
  const p = tokenPath()
  if (existsSync(p)) {
    unlockToken = readFileSync(p, "utf8").trim()
    return unlockToken
  }
  const t = randomBytes(32).toString("base64url")
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, t + "\n", { encoding: "utf8", mode: 0o600 })
  unlockToken = t
  return t
}

/** token を定数時間比較で検証する。 */
export function verifyUnlockToken(candidate: string): boolean {
  const expected = Buffer.from(getOrCreateUnlockToken())
  const got = Buffer.from(candidate)
  if (expected.length !== got.length) return false
  return timingSafeEqual(expected, got)
}

/** テスト専用: モジュール状態をリセットする。 */
export function __resetForTest(): void {
  lock()
  unlockToken = null
}
