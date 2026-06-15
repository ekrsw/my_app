import { describe, it, expect } from "vitest"
import {
  getShiftCodeInfo,
  getColorClasses,
  SHIFT_CODE_MAP,
  COLOR_PALETTE,
} from "@/lib/constants"

describe("getShiftCodeInfo — シフトコードの表示情報解決", () => {
  it("null は '-' のプレースホルダを返す", () => {
    expect(getShiftCodeInfo(null)).toEqual({
      label: "-",
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    })
  })

  it("ハードコードマップのコードを解決する", () => {
    expect(getShiftCodeInfo("A")).toEqual(SHIFT_CODE_MAP.A)
  })

  it("DB マップが渡された場合はそちらを優先する", () => {
    const dbMap = {
      A: { label: "DB日勤", color: "text-pink-800", bgColor: "bg-pink-100" },
    }
    expect(getShiftCodeInfo("A", dbMap)).toEqual(dbMap.A)
  })

  it("DB マップに無いコードはハードコードへフォールバックする", () => {
    const dbMap = {
      Z: { label: "DB専用", color: "text-pink-800", bgColor: "bg-pink-100" },
    }
    expect(getShiftCodeInfo("N", dbMap)).toEqual(SHIFT_CODE_MAP.N)
  })

  it("未知のコードはコード文字をラベルにした灰色を返す", () => {
    expect(getShiftCodeInfo("X")).toEqual({
      label: "X",
      color: "text-gray-800",
      bgColor: "bg-gray-100",
    })
  })
})

describe("getColorClasses — カラーキーから text/bg クラス解決", () => {
  it("null は null を返す", () => {
    expect(getColorClasses(null)).toBeNull()
  })

  it("未知のカラーキーは null を返す", () => {
    expect(getColorClasses("nonexistent")).toBeNull()
  })

  it("既知のカラーキーは text/bg を返す", () => {
    expect(getColorClasses("blue")).toEqual({
      text: COLOR_PALETTE.blue.text,
      bg: COLOR_PALETTE.blue.bg,
    })
  })

  it("swatch は返さず text/bg のみを返す", () => {
    expect(getColorClasses("red")).not.toHaveProperty("swatch")
  })
})
