// シフトコードのラベルと色マッピング
export const SHIFT_CODE_MAP: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
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

export function getShiftCodeInfo(code: string | null) {
  if (!code) return { label: "-", color: "text-muted-foreground", bgColor: "bg-muted" }
  return SHIFT_CODE_MAP[code] ?? { label: code, color: "text-gray-800", bgColor: "bg-gray-100" }
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
] as const
