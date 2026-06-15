import { describe, it, expect } from "vitest"
import { cn, formatTime } from "@/lib/utils"

describe("cn — クラス名のマージ", () => {
  it("複数のクラスを結合する", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("falsy 値を無視する", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1")
  })

  it("条件付きクラス（オブジェクト記法）を展開する", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active")
  })

  it("tailwind の競合クラスは後勝ちでマージする", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })
})

describe("formatTime — ISO/Date から HH:mm 抽出", () => {
  it("null は '-' を返す", () => {
    expect(formatTime(null)).toBe("-")
  })

  it("ISO 文字列から HH:mm を抽出する", () => {
    expect(formatTime("2026-06-15T09:30:00.000Z")).toBe("09:30")
  })

  it("Date オブジェクトから HH:mm を抽出する", () => {
    expect(formatTime(new Date(Date.UTC(2026, 5, 15, 22, 5)))).toBe("22:05")
  })

  it("真夜中を 00:00 で返す", () => {
    expect(formatTime(new Date(Date.UTC(2026, 5, 15, 0, 0)))).toBe("00:00")
  })
})
