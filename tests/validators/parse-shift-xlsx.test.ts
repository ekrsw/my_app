import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import {
  XlsxParseError,
  convertShiftXlsx,
  generateCsv,
  parseShiftXlsx,
  validateRecords,
} from "@/lib/excel/parse-shift-xlsx"
import { parseShiftCsv } from "@/lib/csv/parse-shift-csv"
import type { ShiftCodeMasterRow, ShiftRecord } from "@/types/shift-conversion"

/**
 * Excelバッファを生成する小さなヘルパー。
 * headerDates: 日付ヘッダー (Date or "YYYY/MM/DD" 文字列 or Excelシリアル値 (number))
 * rows: 各行 [従業員名 or '-', ...shiftCodes]
 * sheets: 追加シート (optional)
 */
async function buildXlsx(
  headerA1: string,
  headerDates: Array<Date | string | number>,
  rows: Array<(string | null)[]>,
  extraSheets: Array<{ name: string; rows: string[][] }> = [],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Sheet1")

  const headerRow: (string | Date | number | null)[] = [headerA1, ...headerDates]
  ws.addRow(headerRow)

  for (const r of rows) {
    ws.addRow(r)
  }

  for (const extra of extraSheets) {
    const es = wb.addWorksheet(extra.name)
    for (const r of extra.rows) es.addRow(r)
  }

  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}

const MAY_1 = new Date(Date.UTC(2026, 4, 1))
const MAY_2 = new Date(Date.UTC(2026, 4, 2))
const MAY_3 = new Date(Date.UTC(2026, 4, 3))

const BASE_CODES: ShiftCodeMasterRow[] = [
  {
    code: "9_1730",
    defaultStartTime: "09:00",
    defaultEndTime: "17:30",
    defaultIsHoliday: false,
    defaultLunchBreakStart: "12:00",
    defaultLunchBreakEnd: "13:00",
  },
  {
    code: "土祝",
    defaultStartTime: null,
    defaultEndTime: null,
    defaultIsHoliday: true,
    defaultLunchBreakStart: null,
    defaultLunchBreakEnd: null,
  },
  {
    code: "22_8",
    defaultStartTime: "22:00",
    defaultEndTime: "08:00",
    defaultIsHoliday: false,
    defaultLunchBreakStart: null,
    defaultLunchBreakEnd: null,
  },
]

describe("parseShiftXlsx", () => {
  describe("ヘッダー検証", () => {
    it("A1が '従業員名' なら成功", async () => {
      const buf = await buildXlsx("従業員名", [MAY_1], [["田中太郎", "9_1730"]])
      const { records } = await parseShiftXlsx(buf)
      expect(records).toHaveLength(1)
      expect(records[0]).toEqual({
        employeeName: "田中太郎",
        shiftDate: "2026-05-01",
        shiftCode: "9_1730",
      })
    })

    it("A1が許容ヘッダ以外の場合 XlsxParseError", async () => {
      const buf = await buildXlsx("Random", [MAY_1], [["田中太郎", "9_1730"]])
      await expect(parseShiftXlsx(buf)).rejects.toThrow(XlsxParseError)
    })

    it("A1が '氏名' でも受け入れる", async () => {
      const buf = await buildXlsx("氏名", [MAY_1], [["佐藤花子", "9_1730"]])
      const { records } = await parseShiftXlsx(buf)
      expect(records).toHaveLength(1)
    })

    it("A1のスペース・全角混在を正規化して受理", async () => {
      const buf = await buildXlsx("　従業員名　", [MAY_1], [["田中太郎", "9_1730"]])
      const { records } = await parseShiftXlsx(buf)
      expect(records).toHaveLength(1)
    })

    it("日付ヘッダが空っぽなら XlsxParseError", async () => {
      const buf = await buildXlsx("従業員名", [], [])
      await expect(parseShiftXlsx(buf)).rejects.toThrow(XlsxParseError)
    })

    it("日付ヘッダが解釈不能な文字列なら XlsxParseError", async () => {
      const buf = await buildXlsx("従業員名", ["5月1日"], [["田中太郎", "9_1730"]])
      await expect(parseShiftXlsx(buf)).rejects.toThrow(XlsxParseError)
    })

    it("日付ヘッダが文字列 'YYYY/M/D' でも解釈する", async () => {
      const buf = await buildXlsx("従業員名", ["2026/5/1"], [["田中太郎", "9_1730"]])
      const { records } = await parseShiftXlsx(buf)
      expect(records[0].shiftDate).toBe("2026-05-01")
    })
  })

  describe("データ行", () => {
    it("区切り行 '-' はスキップ", async () => {
      const buf = await buildXlsx("従業員名", [MAY_1, MAY_2], [
        ["田中太郎", "9_1730", "土祝"],
        ["-", "", ""],
        ["佐藤花子", "9_1730", "22_8"],
      ])
      const { records } = await parseShiftXlsx(buf)
      const names = [...new Set(records.map((r) => r.employeeName))]
      expect(names).toEqual(["田中太郎", "佐藤花子"])
    })

    it("空行・全角ハイフン行もスキップ", async () => {
      const buf = await buildXlsx("従業員名", [MAY_1], [
        ["田中太郎", "9_1730"],
        ["", ""],
        ["－", ""],
        ["ー", ""],
      ])
      const { records } = await parseShiftXlsx(buf)
      expect(records).toHaveLength(1)
    })

    it("空セルのshift_codeはスキップ", async () => {
      const buf = await buildXlsx("従業員名", [MAY_1, MAY_2, MAY_3], [
        ["田中太郎", "9_1730", "", "22_8"],
      ])
      const { records } = await parseShiftXlsx(buf)
      expect(records).toHaveLength(2)
      expect(records.map((r) => r.shiftDate)).toEqual(["2026-05-01", "2026-05-03"])
    })

    it("複数シートがあれば警告を返す", async () => {
      const buf = await buildXlsx(
        "従業員名",
        [MAY_1],
        [["田中太郎", "9_1730"]],
        [{ name: "メモ", rows: [["hello"]] }, { name: "一覧", rows: [["world"]] }],
      )
      const { records, warnings } = await parseShiftXlsx(buf)
      expect(records).toHaveLength(1)
      expect(warnings.length).toBeGreaterThan(0)
      expect(warnings[0]).toContain("メモ")
    })

    it("不正バイト列は XlsxParseError", async () => {
      const notXlsx = new TextEncoder().encode("not an xlsx").buffer
      await expect(parseShiftXlsx(notXlsx as ArrayBuffer)).rejects.toThrow(XlsxParseError)
    })
  })
})

describe("validateRecords", () => {
  const employees = ["田中太郎", "佐藤花子"]

  it("すべて既知なら canProceed=true", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "9_1730" },
      { employeeName: "佐藤花子", shiftDate: "2026-05-01", shiftCode: "土祝" },
    ]
    const result = validateRecords(records, BASE_CODES, employees)
    expect(result.canProceed).toBe(true)
    expect(result.recordCount).toBe(2)
    expect(result.unknownCodes).toHaveLength(0)
    expect(result.unknownNames).toHaveLength(0)
    expect(result.duplicateKeys).toHaveLength(0)
  })

  it("未知shift_codeを検出してブロック (出現回数付き)", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "NEW_CODE" },
      { employeeName: "田中太郎", shiftDate: "2026-05-02", shiftCode: "NEW_CODE" },
      { employeeName: "佐藤花子", shiftDate: "2026-05-01", shiftCode: "ANOTHER_NEW" },
    ]
    const result = validateRecords(records, BASE_CODES, employees)
    expect(result.canProceed).toBe(false)
    expect(result.unknownCodes).toHaveLength(2)
    const map = new Map(result.unknownCodes.map((c) => [c.value, c.count]))
    expect(map.get("NEW_CODE")).toBe(2)
    expect(map.get("ANOTHER_NEW")).toBe(1)
  })

  it("未一致従業員名を検出してブロック", () => {
    const records: ShiftRecord[] = [
      { employeeName: "未登録一郎", shiftDate: "2026-05-01", shiftCode: "9_1730" },
    ]
    const result = validateRecords(records, BASE_CODES, employees)
    expect(result.canProceed).toBe(false)
    expect(result.unknownNames).toHaveLength(1)
    expect(result.unknownNames[0]).toEqual({ value: "未登録一郎", count: 1 })
  })

  it("Excel内重複 (name,date) を検出してブロック", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "9_1730" },
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "22_8" },
    ]
    const result = validateRecords(records, BASE_CODES, employees)
    expect(result.canProceed).toBe(false)
    expect(result.duplicateKeys).toHaveLength(1)
    expect(result.duplicateKeys[0]).toEqual({
      employeeName: "田中太郎",
      shiftDate: "2026-05-01",
      count: 2,
    })
  })

  it("空recordsは canProceed=true / recordCount=0", () => {
    const result = validateRecords([], BASE_CODES, employees)
    expect(result.canProceed).toBe(true)
    expect(result.recordCount).toBe(0)
  })

  it("unknownCodes/unknownNames は辞書順でソートされる", () => {
    const records: ShiftRecord[] = [
      { employeeName: "zz", shiftDate: "2026-05-01", shiftCode: "ZZ" },
      { employeeName: "aa", shiftDate: "2026-05-01", shiftCode: "AA" },
    ]
    const result = validateRecords(records, BASE_CODES, employees)
    expect(result.unknownCodes.map((c) => c.value)).toEqual(["AA", "ZZ"])
    expect(result.unknownNames.map((c) => c.value)).toEqual(["aa", "zz"])
  })
})

describe("generateCsv", () => {
  it("BOM + CRLF + 日本語ヘッダ + ソート済み行", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-02", shiftCode: "9_1730" },
      { employeeName: "佐藤花子", shiftDate: "2026-05-01", shiftCode: "土祝" },
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "22_8" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    // BOM
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    // ヘッダー行
    expect(csv).toContain("日付,従業員ID,従業員名,シフトコード,開始時刻,終了時刻,昼休み開始,昼休み終了,休日,テレワーク")
    // CRLF
    expect(csv).toContain("\r\n")
    // ソート済み (佐藤花子 → 田中太郎、各自は日付順)
    const lines = csv.split("\r\n")
    // 1行目: BOM+header, 2行目: 佐藤花子, 3行目: 田中太郎 05-01, 4行目: 田中太郎 05-02
    expect(lines[1]).toContain("佐藤花子")
    expect(lines[1]).toContain("2026/05/01")
    expect(lines[2]).toContain("田中太郎")
    expect(lines[2]).toContain("2026/05/01")
    expect(lines[3]).toContain("田中太郎")
    expect(lines[3]).toContain("2026/05/02")
  })

  it("従業員IDは常に空", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "9_1730" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    const lines = csv.split("\r\n")
    // 2列目が空
    const fields = lines[1].split(",")
    expect(fields[1]).toBe("")
  })

  it("is_holiday=true のshift_codeは 't', falseは 'f'", () => {
    const records: ShiftRecord[] = [
      { employeeName: "A", shiftDate: "2026-05-01", shiftCode: "9_1730" }, // holiday=false
      { employeeName: "A", shiftDate: "2026-05-02", shiftCode: "土祝" }, // holiday=true
    ]
    const csv = generateCsv(records, BASE_CODES)
    const lines = csv.split("\r\n")
    const row1 = lines[1].split(",")
    const row2 = lines[2].split(",")
    // 9列目が休日
    expect(row1[8]).toBe("f")
    expect(row2[8]).toBe("t")
  })

  it("テレワーク列は常に 'f'", () => {
    const records: ShiftRecord[] = [
      { employeeName: "A", shiftDate: "2026-05-01", shiftCode: "9_1730" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    const row1 = csv.split("\r\n")[1].split(",")
    expect(row1[9]).toBe("f")
  })

  it("shift_codesマスタから開始・終了時刻を解決", () => {
    const records: ShiftRecord[] = [
      { employeeName: "A", shiftDate: "2026-05-01", shiftCode: "22_8" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    const row1 = csv.split("\r\n")[1].split(",")
    // 列: 日付,従業員ID,従業員名,シフトコード,開始時刻,終了時刻,昼休み開始,昼休み終了,休日,テレワーク
    expect(row1[4]).toBe("22:00")
    expect(row1[5]).toBe("08:00")
  })

  it("shift_codesマスタにないコードでも行は出力される (時刻は空)", () => {
    const records: ShiftRecord[] = [
      { employeeName: "A", shiftDate: "2026-05-01", shiftCode: "UNKNOWN" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    const row1 = csv.split("\r\n")[1].split(",")
    expect(row1[3]).toBe("UNKNOWN")
    expect(row1[4]).toBe("")
    expect(row1[5]).toBe("")
  })

  it("lunch_break が null の shift_code は空文字", () => {
    const records: ShiftRecord[] = [
      { employeeName: "A", shiftDate: "2026-05-01", shiftCode: "22_8" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    const row1 = csv.split("\r\n")[1].split(",")
    expect(row1[6]).toBe("")
    expect(row1[7]).toBe("")
  })

  it("空records → ヘッダーのみ出力", () => {
    const csv = generateCsv([], BASE_CODES)
    const lines = csv.split("\r\n").filter((l) => l.length > 0)
    expect(lines).toHaveLength(1)
  })
})

describe("ラウンドトリップ: generateCsv → parseShiftCsv", () => {
  it("生成CSVが既存parseShiftCsvで全行valid扱いされる", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "9_1730" },
      { employeeName: "佐藤花子", shiftDate: "2026-05-01", shiftCode: "土祝" },
      { employeeName: "田中太郎", shiftDate: "2026-05-02", shiftCode: "22_8" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    // BOMは除去してから parseShiftCsv に渡す (既存のCsvFileInputがやっている挙動)
    const trimmed = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv
    const parsed = parseShiftCsv(trimmed)
    expect(parsed.headerValid).toBe(true)
    expect(parsed.rows).toHaveLength(3)
    for (const row of parsed.rows) {
      expect(row.valid).toBe(true)
      expect(row.data.employeeId).toBe("")
      expect(row.data._employeeName).toBeTruthy()
    }
  })

  it("休日フラグ 't' が parseShiftCsv で isHoliday=true に復元される", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-01", shiftCode: "土祝" },
    ]
    const csv = generateCsv(records, BASE_CODES)
    const parsed = parseShiftCsv(csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv)
    expect(parsed.rows[0].data.isHoliday).toBe(true)
  })

  it("同一Excel相当の records から2回 generateCsv しても同じバイト列になる (決定論)", () => {
    const records: ShiftRecord[] = [
      { employeeName: "田中太郎", shiftDate: "2026-05-02", shiftCode: "9_1730" },
      { employeeName: "佐藤花子", shiftDate: "2026-05-01", shiftCode: "土祝" },
    ]
    const csv1 = generateCsv(records, BASE_CODES)
    const csv2 = generateCsv([...records].reverse(), BASE_CODES)
    expect(csv1).toBe(csv2)
  })
})

describe("convertShiftXlsx (統合)", () => {
  it("Excelバイナリ→検証OK→CSV生成まで完走", async () => {
    const buf = await buildXlsx("従業員名", [MAY_1, MAY_2], [
      ["田中太郎", "9_1730", "土祝"],
      ["佐藤花子", "土祝", "9_1730"],
    ])
    const res = await convertShiftXlsx(buf, BASE_CODES, ["田中太郎", "佐藤花子"], "test")
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.body.validation.recordCount).toBe(4)
      expect(res.body.filename).toBe("test.csv")
      expect(res.body.csvContent.charCodeAt(0)).toBe(0xfeff)
    }
  })

  it("未知コード1件でも ok=false", async () => {
    const buf = await buildXlsx("従業員名", [MAY_1], [["田中太郎", "UNKNOWN_CODE"]])
    const res = await convertShiftXlsx(buf, BASE_CODES, ["田中太郎"], "test")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.validation.unknownCodes).toHaveLength(1)
    }
  })

  it("未一致名1件でも ok=false", async () => {
    const buf = await buildXlsx("従業員名", [MAY_1], [["未登録一郎", "9_1730"]])
    const res = await convertShiftXlsx(buf, BASE_CODES, ["田中太郎"], "test")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.validation.unknownNames).toHaveLength(1)
    }
  })

  it("Excel内重複でも ok=false", async () => {
    const buf = await buildXlsx("従業員名", [MAY_1], [
      ["田中太郎", "9_1730"],
      ["田中太郎", "22_8"],
    ])
    const res = await convertShiftXlsx(buf, BASE_CODES, ["田中太郎"], "test")
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.validation.duplicateKeys).toHaveLength(1)
    }
  })
})
