/**
 * function_roles.role_type の取り得る値。
 *
 * 以前は `[...types].sort()` による位置依存で「配列[0]=SV、配列[1]=業務」と
 * 扱っていたが、日本語のコードポイント比較では「業務」(U+696D) < 「監督」(U+76E3)
 * であるため ASC ソートで `[0]=業務` となり、SV 判定・UI ラベル・フィルタが
 * 全て逆転するバグが発生していた (CHANGELOG v0.2.13.3 の DESC→ASC 移行で silent に混入)。
 *
 * 位置に頼らず、どのロール種別かは必ずこの定数と比較する。
 */
export const SUPERVISOR_ROLE_TYPE = "監督"
export const BUSINESS_ROLE_TYPE = "業務"

/**
 * 既存コードで配列インデックスに依存している箇所 (カラムラベル・フィルタ・CSV列見出し等)
 * の後方互換のため、`readonly [string, string]` タプルを維持する。
 * インデックスの意味は `[0] = SV、[1] = 業務` と固定。
 */
export const DISTINCT_ROLE_TYPES = [SUPERVISOR_ROLE_TYPE, BUSINESS_ROLE_TYPE] as const

export type DistinctRoleTypes = typeof DISTINCT_ROLE_TYPES
