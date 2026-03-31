/**
 * キャパシティ計算ユーティリティ
 * ダッシュボードの「対応可能人数」表示で使用する純粋関数群
 */

/** ISO文字列 or Date から "HH:mm" を抽出 */
export function getTimeHHMM(d: Date | string): string {
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
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

/** 当番が現在アクティブかどうかを判定（深夜跨ぎ対応） */
export function isDutyActive(
  startTime: Date | string,
  endTime: Date | string,
  now: string
): boolean {
  return isTimeInRange(getTimeHHMM(startTime), getTimeHHMM(endTime), now)
}

/** シフトの出勤・退勤時刻から現在出勤中かどうかを判定（深夜跨ぎ対応） */
export function isWorkerPresent(
  startTime: Date | string | null,
  endTime: Date | string | null,
  now: string
): boolean {
  if (!startTime) return false
  const start = getTimeHHMM(startTime)
  if (!endTime) return start <= now
  return isTimeInRange(start, getTimeHHMM(endTime), now)
}

/** キャパシティを計算。出勤中・当番中ともにリアルタイム判定 */
export function calculateCapacity(
  shifts: Array<{ employeeId: string | null; startTime: Date | string | null; endTime: Date | string | null }>,
  duties: Array<{ employeeId: string; startTime: Date | string; endTime: Date | string }>,
  currentTime: string
): { total: number; onDuty: number; available: number } {
  // 現在時刻に出勤中の従業員をカウント
  const presentEmployeeIds = new Set<string>()
  for (const shift of shifts) {
    if (shift.employeeId && isWorkerPresent(shift.startTime, shift.endTime, currentTime)) {
      presentEmployeeIds.add(shift.employeeId)
    }
  }
  const total = presentEmployeeIds.size

  // 現在時刻に当番中の従業員をカウント（出勤中の人のみ）
  const onDutyEmployeeIds = new Set<string>()
  for (const duty of duties) {
    if (presentEmployeeIds.has(duty.employeeId) && isDutyActive(duty.startTime, duty.endTime, currentTime)) {
      onDutyEmployeeIds.add(duty.employeeId)
    }
  }
  const onDuty = onDutyEmployeeIds.size

  return {
    total,
    onDuty,
    available: Math.max(0, total - onDuty),
  }
}

/** 対応可能人数に応じた色を返す */
export function getCapacityColor(available: number): "green" | "yellow" | "red" {
  if (available >= 3) return "green"
  if (available >= 1) return "yellow"
  return "red"
}
