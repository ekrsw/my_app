/**
 * アプリ内ルートの単一ソース。
 *
 * ルート構成変更（design-20260615）で全ページを `/top` 配下へ移設したため、
 * パスはここに集約する。ハードコードの裸リテラルを各所に散らさないこと
 * （Success Criteria の grep ゲート: lib/routes.ts 以外に /employees 等の
 * 裸リテラルが残らない）。
 *
 * 本ファイルは middleware（Edge ランタイム）からも import されるため、
 * Node 専用モジュールを持ち込まないこと（純粋な文字列・関数のみ）。
 */

export const ROUTES = {
  /** 公開の「工事中」ページ */
  underConstruction: "/",
  login: "/login",
  /** アプリのホーム（旧 `/` のダッシュボード） */
  top: "/top",
  employees: "/top/employees",
  groups: "/top/groups",
  roles: "/top/roles",
  positions: "/top/positions",
  shifts: "/top/shifts",
  shiftHistory: "/top/shifts/history",
  dutyAssignments: "/top/duty-assignments",
  dutyTypes: "/top/duty-types",
  shiftCodes: "/top/shift-codes",
  data: "/top/data",
  help: "/top/help",
} as const

// 動的ルート
export const employeeDetail = (id: string) => `/top/employees/${id}`
export const shiftHistoryDetail = (id: string | number) =>
  `/top/shifts/history/${id}`
export const helpAnchor = (anchor: string) => `/top/help#${anchor}`

/**
 * 公開判定（未認証で到達可能なパス）の単一ソース。
 * 純関数・never-throw を保つこと（middleware の認証ゲートがここで例外を
 * 投げると全リクエストが 500 になる単一障害点になるため）。
 * 判定は pathname のみで行い、クエリ文字列は見ない（`/login?callbackUrl=...`
 * を公開扱いできずリダイレクトループするのを防ぐ）。
 */
export function isPublic(pathname: string): boolean {
  return (
    pathname === ROUTES.underConstruction ||
    pathname === ROUTES.login ||
    // matcher でも除外しているが、matcher を将来緩めた時のフェイルセーフとして
    // 多層防御で意図的に残す。
    pathname.startsWith("/api/auth")
  )
}

/**
 * ログイン後リダイレクト先の検証。オープンリダイレクト防止のため、
 * 同一オリジンの相対パス（`/` 始まり、かつ `//`・`/\` で始まらない）のみ許可し、
 * それ以外は安全な既定（`/top`）にフォールバックする。
 */
export function safeCallback(url: string | null | undefined): string {
  return url &&
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.startsWith("/\\")
    ? url
    : ROUTES.top
}
