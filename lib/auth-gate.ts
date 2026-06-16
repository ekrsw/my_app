import { isPublic } from "@/lib/routes"

/**
 * middleware の認証ゲート判定（純関数）。
 *
 * 実体は middleware（Edge）の `auth((req) => ...)` ラッパーで NextResponse に
 * 変換されるが、判定ロジックはここに集約して純粋に保つ（middleware モックなしで
 * CI ユニットテストできる）。Node 専用 API を持ち込まないこと。
 *
 *   isPublic ─ yes ─▶ next（had_session 設定なし）
 *      │ no
 *   authed? ─ yes ─▶ next（had_session 未設定なら付与）
 *      │ no
 *   /api/* ─ yes ─▶ json401
 *      │ no
 *   hadSession ─ yes ─▶ redirect reason=expired（失効）
 *      └ no ──────────▶ redirect reason=null（初回未認証）
 */
export type GateDecision =
  | { type: "next"; setHadSession: boolean }
  | { type: "json401" }
  | { type: "redirect"; reason: "expired" | null }

export function decideGate(args: {
  pathname: string
  isAuthed: boolean
  hadSession: boolean
}): GateDecision {
  if (isPublic(args.pathname)) return { type: "next", setHadSession: false }
  if (args.isAuthed) return { type: "next", setHadSession: !args.hadSession }
  if (args.pathname.startsWith("/api/")) return { type: "json401" }
  return { type: "redirect", reason: args.hadSession ? "expired" : null }
}
