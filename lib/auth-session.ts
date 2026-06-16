/**
 * セッションの絶対有効期限ロジック（純関数）。
 *
 * Auth.js v5 の JWT 戦略はローリング（アクセスのたびに exp を延長）のため、
 * `session.maxAge` だけでは「ログインから固定時間で必ず失効する絶対期限」に
 * ならない。絶対失効は `auth.config.ts` の jwt コールバックで
 * `isSessionExpired()` を判定し、超過時に `null` を返して実現する。
 *
 * 本モジュールは middleware（Edge ランタイム）経由でも読み込まれるため、
 * Node 専用 API を持ち込まないこと（`process.env` 読みと純粋計算のみ）。
 */

/**
 * 「過去にログイン済み」を示す痕跡 cookie 名。middleware が認証済みリクエストで
 * 立て、signOut でクリアする。未認証 かつ この cookie あり = 失効、と判定して
 * `/login?reason=expired` を出し分けるために使う（サーバー単体では失効と未ログインを
 * 区別できないため）。非機密のブール痕跡。
 */
export const HAD_SESSION_COOKIE = "had_session"

/** had_session cookie の寿命（秒）。30 日。 */
export const HAD_SESSION_MAX_AGE = 60 * 60 * 24 * 30

/** セッション失効時にユーザーへ表示するメッセージ（login-form・401 誘導で共有）。 */
export const SESSION_EXPIRED_MESSAGE =
  "セッションの有効期限が切れました。再度ログインしてください。"

/** 絶対期限のデフォルト（秒）。8 時間 = 1 勤務想定。 */
const DEFAULT_TTL_SECONDS = 8 * 60 * 60

/**
 * 絶対期限（ミリ秒）を返す。`AUTH_ABSOLUTE_SESSION_SECONDS`（秒）で上書き可能。
 * 未設定・不正値（NaN・0 以下）の場合はデフォルト 8 時間にフォールバックする。
 * テストでは `.env.test` で短い値（例 2）に設定して失効を検証できる。
 */
export function getAbsoluteTtlMs(): number {
  const raw = Number(process.env.AUTH_ABSOLUTE_SESSION_SECONDS)
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SECONDS
  return seconds * 1000
}

/**
 * ログイン時刻から絶対期限を超過していれば true。
 *
 * `loginAt` が欠落しているトークン（本機能デプロイ前に発行された既存トークン）は
 * 「移行中」とみなし失効させない（false）。これにより、デプロイ直後に全員が
 * 即ログアウトされるのを避ける（既存トークンは `maxAge` 側の期限まで有効）。
 */
export function isSessionExpired(
  loginAt: number | undefined,
  nowMs: number,
  ttlMs: number
): boolean {
  // undefined のみ「欠落」扱い。0 も有効なタイムスタンプ（falsy 誤判定を避ける）。
  if (loginAt === undefined) return false
  return nowMs - loginAt > ttlMs
}
