import { describe, it, expect } from "vitest"
import { parseShiftCodeCsv } from "@/lib/csv/parse-shift-code-csv"

const HEADER_9 =
  "シフトコード,カラー,開始時刻,終了時刻,休日,有効,表示順,昼休憩開始,昼休憩終了"
const HEADER_7 = "シフトコード,カラー,開始時刻,終了時刻,休日,有効,表示順"

describe("parseShiftCodeCsv", () => {
  it("9列CSV: 昼休憩込み全列 valid", () => {
    const csv = `${HEADER_9}\n9_18,red,09:00,18:00,false,true,1,12:00,13:00`
    const result = parseShiftCodeCsv(csv)

    expect(result.headerValid).toBe(true)
    expect(result.lunchBreakColumnsMissing).toBe(false)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].valid).toBe(true)
    expect(result.rows[0].data.defaultLunchBreakStart).toBe("12:00")
    expect(result.rows[0].data.defaultLunchBreakEnd).toBe("13:00")
  })

  it("9列CSV: 昼休憩値が空欄 → null", () => {
    const csv = `${HEADER_9}\n9_18,,09:00,18:00,false,true,1,,`
    const result = parseShiftCodeCsv(csv)

    expect(result.headerValid).toBe(true)
    expect(result.lunchBreakColumnsMissing).toBe(false)
    expect(result.rows[0].valid).toBe(true)
    expect(result.rows[0].data.defaultLunchBreakStart).toBeNull()
    expect(result.rows[0].data.defaultLunchBreakEnd).toBeNull()
  })

  it("9列CSV: 昼休憩形式不正 (25:99) → row.valid=false", () => {
    const csv = `${HEADER_9}\n9_18,,09:00,18:00,false,true,1,25:99,13:00`
    const result = parseShiftCodeCsv(csv)

    expect(result.rows[0].valid).toBe(false)
    expect(result.rows[0].error).toContain("昼休憩開始の形式が不正です")
  })

  it("9列CSV: 昼休憩終了形式不正 → エラーメッセージ", () => {
    const csv = `${HEADER_9}\n9_18,,09:00,18:00,false,true,1,12:00,abc`
    const result = parseShiftCodeCsv(csv)

    expect(result.rows[0].valid).toBe(false)
    expect(result.rows[0].error).toContain("昼休憩終了の形式が不正です")
  })

  it("[REGRESSION] 7列CSV (旧形式、昼休憩なし) → headerValid=true, lunchBreakColumnsMissing=true", () => {
    const csv = `${HEADER_7}\n9_18,red,09:00,18:00,false,true,1`
    const result = parseShiftCodeCsv(csv)

    expect(result.headerValid).toBe(true)
    expect(result.lunchBreakColumnsMissing).toBe(true)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].valid).toBe(true)
    expect(result.rows[0].data.defaultLunchBreakStart).toBeNull()
    expect(result.rows[0].data.defaultLunchBreakEnd).toBeNull()
  })

  it("8列CSV (昼休憩開始のみ) → lunchBreakColumnsMissing=false", () => {
    const HEADER_8 =
      "シフトコード,カラー,開始時刻,終了時刻,休日,有効,表示順,昼休憩開始"
    const csv = `${HEADER_8}\n9_18,,09:00,18:00,false,true,1,12:00`
    const result = parseShiftCodeCsv(csv)

    expect(result.lunchBreakColumnsMissing).toBe(false)
    expect(result.rows[0].data.defaultLunchBreakStart).toBe("12:00")
    expect(result.rows[0].data.defaultLunchBreakEnd).toBeNull()
  })

  it("8列CSV (昼休憩終了のみ) → lunchBreakColumnsMissing=false", () => {
    const HEADER_8 =
      "シフトコード,カラー,開始時刻,終了時刻,休日,有効,表示順,昼休憩終了"
    const csv = `${HEADER_8}\n9_18,,09:00,18:00,false,true,1,13:00`
    const result = parseShiftCodeCsv(csv)

    expect(result.lunchBreakColumnsMissing).toBe(false)
    expect(result.rows[0].data.defaultLunchBreakStart).toBeNull()
    expect(result.rows[0].data.defaultLunchBreakEnd).toBe("13:00")
  })

  it("CSV 空 → headerError, lunchBreakColumnsMissing=false", () => {
    const result = parseShiftCodeCsv("")

    expect(result.headerValid).toBe(false)
    expect(result.headerError).toBe("CSVが空です")
    expect(result.lunchBreakColumnsMissing).toBe(false)
  })

  it("必須ヘッダー (シフトコード) 欠損 → headerError", () => {
    const csv = "カラー,開始時刻,終了時刻\nred,09:00,18:00"
    const result = parseShiftCodeCsv(csv)

    expect(result.headerValid).toBe(false)
    expect(result.headerError).toContain("シフトコード")
    expect(result.lunchBreakColumnsMissing).toBe(false)
  })
})
