import { describe, it, expect } from "vitest"
import { parseShiftCsv } from "@/lib/csv/parse-shift-csv"

function buildCsv(headers: string[], rows: string[][]): string {
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

describe("parseShiftCsv - 従業員名対応", () => {
  const baseHeaders = ["日付", "従業員ID", "従業員名", "シフトコード", "開始時刻", "終了時刻", "休日", "テレワーク"]
  const nameOnlyHeaders = ["日付", "従業員名", "シフトコード", "開始時刻", "終了時刻", "休日", "テレワーク"]

  describe("ヘッダー検証", () => {
    it("従業員IDと従業員名の両方のヘッダーがある場合は有効", () => {
      const csv = buildCsv(baseHeaders, [
        ["2026/01/15", "550e8400-e29b-41d4-a716-446655440000", "田中太郎", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.headerValid).toBe(true)
    })

    it("従業員名ヘッダーのみの場合は有効", () => {
      const csv = buildCsv(nameOnlyHeaders, [
        ["2026/01/15", "田中太郎", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.headerValid).toBe(true)
    })

    it("従業員IDヘッダーのみの場合は有効", () => {
      const idOnlyHeaders = ["日付", "従業員ID", "シフトコード", "開始時刻", "終了時刻", "休日", "テレワーク"]
      const csv = buildCsv(idOnlyHeaders, [
        ["2026/01/15", "550e8400-e29b-41d4-a716-446655440000", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.headerValid).toBe(true)
    })

    it("従業員IDと従業員名の両方のヘッダーがない場合はエラー", () => {
      const noEmployeeHeaders = ["日付", "シフトコード", "開始時刻", "終了時刻", "休日", "テレワーク"]
      const csv = buildCsv(noEmployeeHeaders, [
        ["2026/01/15", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.headerValid).toBe(false)
      expect(result.headerError).toContain("従業員ID")
      expect(result.headerError).toContain("従業員名")
    })
  })

  describe("行レベル検証", () => {
    it("従業員IDあり + 従業員名あり → 有効", () => {
      const csv = buildCsv(baseHeaders, [
        ["2026/01/15", "550e8400-e29b-41d4-a716-446655440000", "田中太郎", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.employeeId).toBe("550e8400-e29b-41d4-a716-446655440000")
      expect(result.rows[0].data._employeeName).toBe("田中太郎")
    })

    it("従業員ID空 + 従業員名あり → 有効", () => {
      const csv = buildCsv(baseHeaders, [
        ["2026/01/15", "", "田中太郎", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.employeeId).toBe("")
      expect(result.rows[0].data._employeeName).toBe("田中太郎")
    })

    it("従業員ID空 + 従業員名空 → エラー", () => {
      const csv = buildCsv(baseHeaders, [
        ["2026/01/15", "", "", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("従業員IDまたは従業員名のいずれかは必須です")
    })

    it("従業員名ヘッダーのみの場合、従業員名ありで有効", () => {
      const csv = buildCsv(nameOnlyHeaders, [
        ["2026/01/15", "田中太郎", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.employeeId).toBe("")
      expect(result.rows[0].data._employeeName).toBe("田中太郎")
    })

    it("従業員名ヘッダーのみの場合、従業員名空でエラー", () => {
      const csv = buildCsv(nameOnlyHeaders, [
        ["2026/01/15", "", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("従業員IDまたは従業員名のいずれかは必須です")
    })

    it("不正なUUID形式の従業員IDはエラー", () => {
      const csv = buildCsv(baseHeaders, [
        ["2026/01/15", "invalid-uuid", "田中太郎", "A", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("UUID")
    })

    it("複数行の混在: ID指定行と名前指定行", () => {
      const csv = buildCsv(baseHeaders, [
        ["2026/01/15", "550e8400-e29b-41d4-a716-446655440000", "", "A", "09:00", "18:00", "f", "f"],
        ["2026/01/16", "", "佐藤花子", "B", "10:00", "19:00", "f", "f"],
        ["2026/01/17", "", "", "C", "09:00", "18:00", "f", "f"],
      ])
      const result = parseShiftCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[1].valid).toBe(true)
      expect(result.rows[2].valid).toBe(false)
    })
  })
})
