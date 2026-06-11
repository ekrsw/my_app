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
//
// 重要: 状態は globalThis に載せる。Next.js は同一プロセス内でも route handler 層と
// RSC（サーバーコンポーネント）層で本モジュールを別インスタンスとして評価しうるため、
// 単純なモジュールスコープ変数だと unlock（route）でメモリに載せた DEK が
// page 描画（RSC: SealedBanner・復号拡張）から見えず、アンロック後も「ロック中」のままになる。
// lib/prisma.ts と同じ globalThis シングルトン方式で、全モジュールインスタンス間で共有する。
const globalForKeyring = globalThis as unknown as {
  __keyringDek?: Buffer | null
  __keyringUnlockToken?: string | null
}

function getDek(): Buffer | null {
  return globalForKeyring.__keyringDek ?? null
}
function setDek(value: Buffer | null): void {
  globalForKeyring.__keyringDek = value
}
function getUnlockToken(): string | null {
  return globalForKeyring.__keyringUnlockToken ?? null
}
function setUnlockToken(value: string | null): void {
  globalForKeyring.__keyringUnlockToken = value
}

function keyringPath(): string {
  return resolve(process.cwd(), process.env.KEYRING_PATH ?? "secrets/keyring.json")
}

function tokenPath(): string {
  return resolve(process.cwd(), process.env.UNLOCK_TOKEN_PATH ?? "secrets/unlock.token")
}

/** 鍵がメモリに載っているか（= 暗号操作が可能か）。 */
export function isUnlocked(): boolean {
  return getDek() !== null
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
  setDek(candidate)
}

/** メモリ上の DEK を消去して sealed に戻す。 */
export function lock(): void {
  const dek = getDek()
  if (dek) dek.fill(0)
  setDek(null)
}

/** 平文を暗号化。sealed 中は KeyringSealedError を throw（暗号文や null を返さない）。 */
export function encrypt(plaintext: string): string {
  const dek = getDek()
  if (!dek) throw new KeyringSealedError()
  return encryptWithKey(dek, Buffer.from(plaintext, "utf8"))
}

/** 暗号文を復号。sealed 中は KeyringSealedError を throw。 */
export function decrypt(token: string): string {
  const dek = getDek()
  if (!dek) throw new KeyringSealedError()
  return decryptWithKey(dek, token).toString("utf8")
}

/**
 * unlock エンドポイント用のローカル token を取得（無ければ生成してファイルに書く）。
 * token は鍵素材ではなく「同一マシン上でアンロックを試行する権利」を表すだけ。
 * ローカル CLI はこのファイルを読んで unlock リクエストに添える。
 */
export function getOrCreateUnlockToken(): string {
  const existing = getUnlockToken()
  if (existing) return existing
  const p = tokenPath()
  if (existsSync(p)) {
    const fromFile = readFileSync(p, "utf8").trim()
    setUnlockToken(fromFile)
    return fromFile
  }
  const t = randomBytes(32).toString("base64url")
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, t + "\n", { encoding: "utf8", mode: 0o600 })
  setUnlockToken(t)
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
  setUnlockToken(null)
}
