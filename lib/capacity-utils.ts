/**
 * キャパシティ計算ユーティリティ
 * タイムラインヒートマップのフッター統計やシフト時刻判定で使用する純粋関数群
 */

/** ISO文字列 or Date から "HH:mm" を抽出 */
export function getTimeHHMM(d: Date | string): string {
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

/** 現在のJST日付を "YYYY-MM-DD" で返す */
export function getTodayJSTDateStr(): string {
  const now = new Date()
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000
  const jst = new Date(jstMs)
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`
}

/** Date または ISO 文字列から "YYYY-MM-DD" を抽出 */
function toDateStr(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().substring(0, 10)
  return String(d).substring(0, 10)
}

/** ロール割り当ての startDate/endDate が指定日を含む有効期間内かを判定 */
export function isRoleActiveOnDate(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  dateStr: string
): boolean {
  if (startDate) {
    if (toDateStr(startDate) > dateStr) return false
  }
  if (endDate) {
    if (toDateStr(endDate) < dateStr) return false
  }
  return true
}

/** 現在のJST時刻を "HH:mm" で返す */
export function getCurrentJSTTimeHHMM(): string {
  const now = new Date()
  const jstHours = (now.getUTCHours() + 9) % 24
  const minutes = now.getUTCMinutes()
  return `${String(jstHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * 時刻が start〜end の範囲内かを判定（深夜跨ぎ対応）
 * end < start の場合は日跨ぎとみなす（例: 22:00〜08:00）
 */
export function isTimeInRange(start: string, end: string, now: string): boolean {
  if (start <= end) {
    // 通常: 09:00〜17:00
    return start <= now && now <= end
  }
  // 深夜跨ぎ: 22:00〜08:00 → 22:00以降 or 08:00以前
  return now >= start || now <= end
}

/** 昼休憩中かどうかを判定（半開区間 [start, end) で判定） */
export function isLunchBreak(
  lunchStart: Date | string | null | undefined,
  lunchEnd: Date | string | null | undefined,
  slot: string
): boolean {
  if (!lunchStart || !lunchEnd) return false
  const start = getTimeHHMM(lunchStart)
  const end = getTimeHHMM(lunchEnd)
  return slot >= start && slot < end
}

/** 当番が現在アクティブかどうかを判定（深夜跨ぎ対応） */
export function isDutyActive(
  startTime: Date | string,
  endTime: Date | string,
  now: string
): boolean {
  return isTimeInRange(getTimeHHMM(startTime), getTimeHHMM(endTime), now)
}

/** シフトの出勤・退勤時刻から現在出勤中かどうかを判定（深夜跨ぎ対応）
 * @param forTodayShift true の場合、日跨ぎシフト（start > end）は「開始時刻以降のみ在勤」とみなす。
 *   深夜〜終了時刻の範囲（例: 0:00〜08:00）は翌日の getYesterdayOvernightShifts が担当するため。
 */
export function isWorkerPresent(
  startTime: Date | string | null,
  endTime: Date | string | null,
  now: string,
  forTodayShift?: boolean,
  lunchBreakStart?: Date | string | null,
  lunchBreakEnd?: Date | string | null
): boolean {
  if (!startTime) return false
  const start = getTimeHHMM(startTime)
  if (isLunchBreak(lunchBreakStart, lunchBreakEnd, now)) return false
  if (!endTime) return start <= now
  const end = getTimeHHMM(endTime)
  if (forTodayShift && start > end) {
    // 今日のシフトで日跨ぎ（例: 22:00-08:00）: 開始時刻以降のみ在勤とみなす
    // 深夜0:00〜終了時刻の範囲は翌日の overnight 処理（isYesterdayOvernight）が担う
    return now >= start
  }
  return isTimeInRange(start, end, now)
}

/** 対応可能人数に応じた色を返す */
export function getCapacityColor(available: number): "green" | "yellow" | "red" {
  if (available >= 3) return "green"
  if (available >= 1) return "yellow"
  return "red"
}
