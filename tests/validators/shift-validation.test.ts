import { describe, it, expect } from "vitest"
import {
  validateDutyWithinShift,
  type ShiftForValidation,
} from "@/lib/shift-validation"

/** ヘルパー: HH:MM文字列からPrisma @db.Time(6)互換のDateを作成 */
function timeDate(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`)
}

function makeShift(
  startTime: string | null,
  endTime: string | null,
  isHoliday = false
): ShiftForValidation {
  return {
    startTime: startTime ? timeDate(startTime) : null,
    endTime: endTime ? timeDate(endTime) : null,
    isHoliday,
  }
}

describe("validateDutyWithinShift", () => {
  // --- エラーケース: シフトなし / 休日 / startTime null ---

  it("シフト未登録 → エラー", () => {
    const result = validateDutyWithinShift(null, "09:00", "12:00")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("出勤予定がありません")
    }
  })

  it("休日シフト → エラー", () => {
    const shift = makeShift("09:00", "17:00", true)
    const result = validateDutyWithinShift(shift, "09:00", "12:00")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("出勤予定がありません")
    }
  })

  it("startTime null → エラー", () => {
    const shift = makeShift(null, "17:00")
    const result = validateDutyWithinShift(shift, "09:00", "12:00")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("勤務時間が設定されていません")
    }
  })

  // --- 通常シフト（startTime <= endTime）---

  it("通常シフト内の業務 → OK", () => {
    const shift = makeShift("09:00", "17:00")
    const result = validateDutyWithinShift(shift, "10:00", "12:00")
    expect(result.ok).toBe(true)
  })

  it("通常シフト外の業務 → エラー", () => {
    const shift = makeShift("09:00", "17:00")
    const result = validateDutyWithinShift(shift, "18:00", "20:00")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("09:00〜17:00")
    }
  })

  it("通常シフトの境界ちょうど → OK", () => {
    const shift = makeShift("09:00", "17:00")
    const result = validateDutyWithinShift(shift, "09:00", "17:00")
    expect(result.ok).toBe(true)
  })

  it("通常シフトで業務がはみ出す → エラー", () => {
    const shift = makeShift("09:00", "17:00")
    const result = validateDutyWithinShift(shift, "16:00", "18:00")
    expect(result.ok).toBe(false)
  })

  // --- 深夜跨ぎシフト（endTime < startTime）---

  it("深夜跨ぎシフト + 第1区間(22:00以降)の業務 → OK", () => {
    const shift = makeShift("22:00", "08:00")
    const result = validateDutyWithinShift(shift, "23:00", "23:30")
    expect(result.ok).toBe(true)
  })

  it("深夜跨ぎシフト + 第2区間(08:00以前)の業務 → OK", () => {
    const shift = makeShift("22:00", "08:00")
    const result = validateDutyWithinShift(shift, "06:00", "07:00")
    expect(result.ok).toBe(true)
  })

  it("深夜跨ぎシフト + 範囲外の業務 → エラー", () => {
    const shift = makeShift("22:00", "08:00")
    const result = validateDutyWithinShift(shift, "10:00", "12:00")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("22:00〜08:00")
    }
  })

  it("深夜跨ぎシフトの境界ちょうど(22:00-08:00) → OK", () => {
    const shift = makeShift("22:00", "08:00")
    const result = validateDutyWithinShift(shift, "22:00", "08:00")
    // 業務自体も深夜跨ぎ(08:00 < 22:00)なので深夜跨ぎ業務ケース
    expect(result.ok).toBe(true)
  })

  it("深夜跨ぎシフト + 境界外(21:59) → エラー", () => {
    const shift = makeShift("22:00", "08:00")
    const result = validateDutyWithinShift(shift, "21:00", "21:59")
    expect(result.ok).toBe(false)
  })

  // --- 深夜跨ぎ業務 ---

  it("深夜跨ぎ業務 + 深夜跨ぎシフト → OK", () => {
    const shift = makeShift("22:00", "08:00")
    const result = validateDutyWithinShift(shift, "23:00", "02:00")
    expect(result.ok).toBe(true)
  })

  it("深夜跨ぎ業務 + 通常シフト → エラー", () => {
    const shift = makeShift("09:00", "17:00")
    const result = validateDutyWithinShift(shift, "23:00", "02:00")
    expect(result.ok).toBe(false)
  })
})
