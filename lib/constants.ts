// シフトコードの表示情報型
export type ShiftCodeInfo = { label: string; color: string; bgColor: string }

// シフトコードのラベルと色マッピング（ハードコード固定・フォールバック用）
export const SHIFT_CODE_MAP: Record<string, ShiftCodeInfo> = {
  A: { label: "日勤A", color: "text-blue-800", bgColor: "bg-blue-100" },
  B: { label: "日勤B", color: "text-indigo-800", bgColor: "bg-indigo-100" },
  C: { label: "日勤C", color: "text-purple-800", bgColor: "bg-purple-100" },
  N: { label: "夜勤", color: "text-gray-800", bgColor: "bg-gray-200" },
  H: { label: "休日", color: "text-red-800", bgColor: "bg-red-100" },
  Y: { label: "有給", color: "text-green-800", bgColor: "bg-green-100" },
  T: { label: "テレワーク", color: "text-sky-800", bgColor: "bg-sky-100" },
  R: { label: "振休", color: "text-orange-800", bgColor: "bg-orange-100" },
  S: { label: "特休", color: "text-yellow-800", bgColor: "bg-yellow-100" },
} as const

export function getShiftCodeInfo(
  code: string | null,
  dbMap?: Record<string, ShiftCodeInfo>
): ShiftCodeInfo {
  if (!code) return { label: "-", color: "text-muted-foreground", bgColor: "bg-muted" }
  // DB マップ優先 → ハードコードフォールバック
  if (dbMap?.[code]) return dbMap[code]
  return SHIFT_CODE_MAP[code] ?? { label: code, color: "text-gray-800", bgColor: "bg-gray-100" }
}

// カラーパレット（シフトコード色選択用）
export type ColorPaletteItem = {
  label: string
  text: string
  bg: string
  swatch: string
}

export const COLOR_PALETTE: Record<string, ColorPaletteItem> = {
  blue:    { label: "青",     text: "text-blue-800",    bg: "bg-blue-100",    swatch: "bg-blue-500" },
  indigo:  { label: "藍",     text: "text-indigo-800",  bg: "bg-indigo-100",  swatch: "bg-indigo-500" },
  purple:  { label: "紫",     text: "text-purple-800",  bg: "bg-purple-100",  swatch: "bg-purple-500" },
  gray:    { label: "灰",     text: "text-gray-800",    bg: "bg-gray-200",    swatch: "bg-gray-500" },
  red:     { label: "赤",     text: "text-red-800",     bg: "bg-red-100",     swatch: "bg-red-500" },
  green:   { label: "緑",     text: "text-green-800",   bg: "bg-green-100",   swatch: "bg-green-500" },
  sky:     { label: "水色",   text: "text-sky-800",     bg: "bg-sky-100",     swatch: "bg-sky-500" },
  orange:  { label: "橙",     text: "text-orange-800",  bg: "bg-orange-100",  swatch: "bg-orange-500" },
  yellow:  { label: "黄",     text: "text-yellow-800",  bg: "bg-yellow-100",  swatch: "bg-yellow-500" },
  pink:    { label: "桃",     text: "text-pink-800",    bg: "bg-pink-100",    swatch: "bg-pink-500" },
  teal:    { label: "鴨の羽", text: "text-teal-800",    bg: "bg-teal-100",    swatch: "bg-teal-500" },
  emerald: { label: "翠",     text: "text-emerald-800", bg: "bg-emerald-100", swatch: "bg-emerald-500" },
  rose:    { label: "薔薇",   text: "text-rose-800",    bg: "bg-rose-100",    swatch: "bg-rose-500" },
  amber:   { label: "琥珀",   text: "text-amber-800",   bg: "bg-amber-100",   swatch: "bg-amber-500" },
  cyan:    { label: "シアン", text: "text-cyan-800",    bg: "bg-cyan-100",    swatch: "bg-cyan-500" },
  violet:  { label: "菫",     text: "text-violet-800",  bg: "bg-violet-100",  swatch: "bg-violet-500" },
  lime:    { label: "黄緑",   text: "text-lime-800",    bg: "bg-lime-100",    swatch: "bg-lime-500" },
  slate:   { label: "石板",   text: "text-slate-800",   bg: "bg-slate-100",   swatch: "bg-slate-500" },
} as const

export function getColorClasses(colorKey: string | null): { text: string; bg: string } | null {
  if (!colorKey) return null
  const palette = COLOR_PALETTE[colorKey]
  if (!palette) return null
  return { text: palette.text, bg: palette.bg }
}

// 役割タイプのラベル
export const ROLE_TYPE_LABELS: Record<string, string> = {
  FUNCTION: "業務",
  AUTHORITY: "監督",
}

// ページサイズ
export const PAGE_SIZES = [10, 20, 50, 100] as const
export const DEFAULT_PAGE_SIZE = 20

// ナビゲーション
export const NAV_ITEMS = [
  { label: "ダッシュボード", href: "/", icon: "LayoutDashboard" },
  { label: "シフト管理", href: "/shifts", icon: "Calendar" },
  { label: "シフト履歴", href: "/shifts/history", icon: "History" },
  { label: "従業員", href: "/employees", icon: "Users" },
  { label: "グループ", href: "/groups", icon: "FolderOpen" },
  { label: "役割", href: "/roles", icon: "Shield" },
  { label: "役職", href: "/positions", icon: "Award" },
  { label: "シフトコード", href: "/shift-codes", icon: "Tag" },
] as const
