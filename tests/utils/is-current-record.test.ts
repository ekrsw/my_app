import { describe, it, expect } from "vitest"
import { isCurrentRecord } from "@/lib/date-utils"

// 判定基準日を固定（JST UTC midnight 相当の Date）
const today = new Date(Date.UTC(2026, 5, 14)) // 2026-06-14

const past = new Date(Date.UTC(2020, 0, 1)) // 2020-01-01
const future = new Date(Date.UTC(2030, 11, 31)) // 2030-12-31

describe("isCurrentRecord — 開始日/終了日からの current 判定", () => {
  describe("startDate が null（未入力）のケース", () => {
    it("startDate=null, endDate=null は現在有効と判定される", () => {
      expect(isCurrentRecord({ startDate: null, endDate: null }, today)).toBe(true)
    })

    it("startDate=null, endDate=未来 は現在有効と判定される", () => {
      expect(isCurrentRecord({ startDate: null, endDate: future }, today)).toBe(true)
    })

    it("startDate=null, endDate=過去 は終了済みと判定される", () => {
      expect(isCurrentRecord({ startDate: null, endDate: past }, today)).toBe(false)
    })

    it("startDate=null, endDate=今日 は現在有効と判定される（境界）", () => {
      expect(isCurrentRecord({ startDate: null, endDate: today }, today)).toBe(true)
    })
  })

  describe("startDate が入力されているケース", () => {
    it("startDate=過去, endDate=null は現在有効", () => {
      expect(isCurrentRecord({ startDate: past, endDate: null }, today)).toBe(true)
    })

    it("startDate=未来 はまだ開始前なので current ではない", () => {
      expect(isCurrentRecord({ startDate: future, endDate: null }, today)).toBe(false)
    })

    it("startDate=今日 は current（境界）", () => {
      expect(isCurrentRecord({ startDate: today, endDate: null }, today)).toBe(true)
    })

    it("startDate=過去, endDate=過去 は終了済み", () => {
      expect(isCurrentRecord({ startDate: past, endDate: past }, today)).toBe(false)
    })
  })

  it("today を省略すると getTodayJST() が使われる（例外なく真偽値を返す）", () => {
    const result = isCurrentRecord({ startDate: null, endDate: null })
    expect(typeof result).toBe("boolean")
    expect(result).toBe(true)
  })
})
