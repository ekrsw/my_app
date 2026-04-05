/**
 * シフト整合性バリデーション
 * 業務割当の時間帯が従業員のシフト時間内に収まるかを判定する純粋関数
 *
 *  SHIFT TIME VALIDATION LOGIC
 *  ===========================
 *
 *  Normal shift (start <= end):
 *    |---shift---|
 *      |duty|        → OK (duty within shift)
 *    |duty|            → OK (boundary match)
 *         |duty|      → NG (duty extends past shift)
 *
 *  Overnight shift (end < start, e.g., 22:00-08:00):
 *    Interval 1: start~24:00    Interval 2: 00:00~end
 *    |=====|                    |=====|
 *      |d|                                  → OK (in interval 1)
 *                               |d|        → OK (in interval 2)
 *              |d|                          → NG (gap between intervals)
 *
 *  Overnight duty (dutyEnd < dutyStart, e.g., 23:00-02:00):
 *    Expand to 2 intervals: dutyStart~24:00 + 00:00~dutyEnd
 *    Both must fit within the shift's valid time range
 */

import { getTimeHHMM } from "@/lib/capacity-utils"

export type ShiftForValidation = {
  startTime: Date | null
  endTime: Date | null
  isHoliday: boolean | null
} | null

export type ShiftValidationResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * 業務の時間帯がシフト時間内に収まるかを判定する
 * @param shift - 従業員のシフト（null = シフト未登録）
 * @param dutyStartTime - 業務の開始時刻（HH:MM形式）
 * @param dutyEndTime - 業務の終了時刻（HH:MM形式）
 */
export function validateDutyWithinShift(
  shift: ShiftForValidation,
  dutyStartTime: string,
  dutyEndTime: string
): ShiftValidationResult {
  if (!shift) {
    return { ok: false, error: "この従業員は指定日に出勤予定がありません" }
  }

  if (shift.isHoliday) {
    return { ok: false, error: "この従業員は指定日に出勤予定がありません" }
  }

  if (!shift.startTime) {
    return { ok: false, error: "この従業員のシフトに勤務時間が設定されていません" }
  }

  const shiftStart = getTimeHHMM(shift.startTime)
  const shiftEnd = shift.endTime ? getTimeHHMM(shift.endTime) : shiftStart

  const isOvernightShift = shiftEnd < shiftStart
  const isOvernightDuty = dutyEndTime < dutyStartTime

  if (isOvernightDuty && !isOvernightShift) {
    return {
      ok: false,
      error: `この従業員のシフト（${shiftStart}〜${shiftEnd}）外の時間帯です`,
    }
  }

  if (!isOvernightShift && !isOvernightDuty) {
    // 通常シフト + 通常業務
    if (dutyStartTime >= shiftStart && dutyEndTime <= shiftEnd) {
      return { ok: true }
    }
    return {
      ok: false,
      error: `この従業員のシフト（${shiftStart}〜${shiftEnd}）外の時間帯です`,
    }
  }

  if (isOvernightShift && !isOvernightDuty) {
    // 深夜跨ぎシフト + 通常業務
    // 業務が第1区間(shiftStart~24:00)か第2区間(00:00~shiftEnd)に収まるか
    const inInterval1 = dutyStartTime >= shiftStart && dutyEndTime >= shiftStart
    const inInterval2 = dutyStartTime <= shiftEnd && dutyEndTime <= shiftEnd
    if (inInterval1 || inInterval2) {
      return { ok: true }
    }
    return {
      ok: false,
      error: `この従業員のシフト（${shiftStart}〜${shiftEnd}）外の時間帯です`,
    }
  }

  // 深夜跨ぎシフト + 深夜跨ぎ業務
  // 業務の第1区間(dutyStart~24:00)がシフトの第1区間(shiftStart~24:00)内
  // 業務の第2区間(00:00~dutyEnd)がシフトの第2区間(00:00~shiftEnd)内
  const duty1InShift1 = dutyStartTime >= shiftStart
  const duty2InShift2 = dutyEndTime <= shiftEnd
  if (duty1InShift1 && duty2InShift2) {
    return { ok: true }
  }
  return {
    ok: false,
    error: `この従業員のシフト（${shiftStart}〜${shiftEnd}）外の時間帯です`,
  }
}
