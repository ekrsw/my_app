/**
 * UI 表示用のロール種別ラベル。
 *
 * 意味論（どのロールが SV か業務か）は DB の `FunctionRole.kind` enum で判定される。
 * このファイルは列見出しや CSV 列名など、**表示文字列**のためだけに存在する。
 *
 * 歴史: 以前は DB の role_type 文字列（"監督"/"業務" 等）を意味論判定にも使って
 * いたが、環境ごとに master 値が異なる（"権限"/"職務" 等）ため誤動作していた。
 * kind enum 導入により表示と意味論を完全に分離し、本定数は UI ラベル専用とした。
 */
export const SUPERVISOR_LABEL = "監督"
export const BUSINESS_LABEL = "業務"

/**
 * 既存コードで `distinctRoleTypes[0] = SV / [1] = 業務` のタプル前提で参照している
 * 箇所のための後方互換エクスポート。新規コードは `SUPERVISOR_LABEL` /
 * `BUSINESS_LABEL` を直接参照すること。
 */
export const DISTINCT_ROLE_TYPES = [SUPERVISOR_LABEL, BUSINESS_LABEL] as const
export type DistinctRoleTypes = typeof DISTINCT_ROLE_TYPES
