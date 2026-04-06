import { describe, it, expect } from "vitest"
import { isPresent, isPresentOvernight, generateTimeSlots } from "@/components/dashboard/timeline-heatmap"

// Prisma @db.Time(6) は 1970-01-01T{HH:mm:ss}Z 形式のDateオブジェクト
// getTimeHHMM はISOの11-16文字目(UTC部分)を抽出する
function time(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`)
}

describe("isPresent (ヒートマップ用在席判定)", () => {
  describe("通常シフト (start <= end)", () => {
    it("9:00-17:00 シフト: 勤務時間内のスロットはtrue", () => {
      expect(isPresent(time("09:00"), time("17:00"), "09:00")).toBe(true)
      expect(isPresent(time("09:00"), time("17:00"), "12:00")).toBe(true)
      expect(isPresent(time("09:00"), time("17:00"), "16:30")).toBe(true)
    })

    it("9:00-17:00 シフト: 終業時刻(17:00)のスロットはfalse", () => {
      expect(isPresent(time("09:00"), time("17:00"), "17:00")).toBe(false)
    })

    it("9:00-17:00 シフト: 勤務時間外のスロットはfalse", () => {
      expect(isPresent(time("09:00"), time("17:00"), "08:00")).toBe(false)
      expect(isPresent(time("09:00"), time("17:00"), "08:30")).toBe(false)
      expect(isPresent(time("09:00"), time("17:00"), "17:30")).toBe(false)
      expect(isPresent(time("09:00"), time("17:00"), "21:00")).toBe(false)
    })

    it("8:30-17:30 シフト: 境界値チェック", () => {
      expect(isPresent(time("08:30"), time("17:30"), "08:00")).toBe(false)
      expect(isPresent(time("08:30"), time("17:30"), "08:30")).toBe(true)
      expect(isPresent(time("08:30"), time("17:30"), "17:00")).toBe(true)
      expect(isPresent(time("08:30"), time("17:30"), "17:30")).toBe(false)
    })
  })

  describe("深夜跨ぎシフト (end < start)", () => {
    it("22:00-08:00 シフト: 8:00台のスロットはfalse（翌日側は含めない）", () => {
      expect(isPresent(time("22:00"), time("08:00"), "08:00")).toBe(false)
      expect(isPresent(time("22:00"), time("08:00"), "08:30")).toBe(false)
    })

    it("22:00-08:00 シフト: ヒートマップ範囲内の全スロットはfalse（22:00は範囲外）", () => {
      expect(isPresent(time("22:00"), time("08:00"), "09:00")).toBe(false)
      expect(isPresent(time("22:00"), time("08:00"), "12:00")).toBe(false)
      expect(isPresent(time("22:00"), time("08:00"), "21:30")).toBe(false)
    })

    it("20:00-04:00 シフト: 20:00以降のスロットはtrue", () => {
      expect(isPresent(time("20:00"), time("04:00"), "19:30")).toBe(false)
      expect(isPresent(time("20:00"), time("04:00"), "20:00")).toBe(true)
      expect(isPresent(time("20:00"), time("04:00"), "20:30")).toBe(true)
      expect(isPresent(time("20:00"), time("04:00"), "21:00")).toBe(true)
      expect(isPresent(time("20:00"), time("04:00"), "21:30")).toBe(true)
    })

    it("20:00-04:00 シフト: 08:00-19:30のスロットはfalse", () => {
      expect(isPresent(time("20:00"), time("04:00"), "08:00")).toBe(false)
      expect(isPresent(time("20:00"), time("04:00"), "12:00")).toBe(false)
      expect(isPresent(time("20:00"), time("04:00"), "19:30")).toBe(false)
    })
  })

  describe("null/境界ケース", () => {
    it("startTime=null → false", () => {
      expect(isPresent(null, null, "09:00")).toBe(false)
      expect(isPresent(null, time("17:00"), "09:00")).toBe(false)
    })

    it("endTime=null → startTime以降ならtrue", () => {
      expect(isPresent(time("09:00"), null, "08:30")).toBe(false)
      expect(isPresent(time("09:00"), null, "09:00")).toBe(true)
      expect(isPresent(time("09:00"), null, "21:30")).toBe(true)
    })
  })
})

describe("isPresentOvernight (前日夜勤の在席判定)", () => {
  it("endTime=08:00: 0:00-07:30はtrue, 08:00以降はfalse", () => {
    expect(isPresentOvernight(time("08:00"), "00:00")).toBe(true)
    expect(isPresentOvernight(time("08:00"), "04:00")).toBe(true)
    expect(isPresentOvernight(time("08:00"), "07:30")).toBe(true)
    expect(isPresentOvernight(time("08:00"), "08:00")).toBe(false)
    expect(isPresentOvernight(time("08:00"), "12:00")).toBe(false)
  })

  it("endTime=06:00: 0:00-05:30はtrue, 06:00以降はfalse", () => {
    expect(isPresentOvernight(time("06:00"), "00:00")).toBe(true)
    expect(isPresentOvernight(time("06:00"), "05:30")).toBe(true)
    expect(isPresentOvernight(time("06:00"), "06:00")).toBe(false)
  })

  it("endTime=00:00: すべてfalse（slot < '00:00' は成立しない）", () => {
    expect(isPresentOvernight(time("00:00"), "00:00")).toBe(false)
    expect(isPresentOvernight(time("00:00"), "08:00")).toBe(false)
  })

  it("endTime=null: false", () => {
    expect(isPresentOvernight(null, "04:00")).toBe(false)
  })
})

describe("generateTimeSlots", () => {
  it("8:00-22:00で28スロット生成", () => {
    const slots = generateTimeSlots(8, 22)
    expect(slots).toHaveLength(28)
    expect(slots[0]).toBe("08:00")
    expect(slots[slots.length - 1]).toBe("21:30")
  })

  it("0:00-24:00で48スロット生成", () => {
    const slots = generateTimeSlots(0, 24)
    expect(slots).toHaveLength(48)
    expect(slots[0]).toBe("00:00")
    expect(slots[slots.length - 1]).toBe("23:30")
  })
})
