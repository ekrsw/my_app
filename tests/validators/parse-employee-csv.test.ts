import { describe, it, expect } from "vitest"
import { parseEmployeeCsv } from "@/lib/csv/parse-employee-csv"

function buildCsv(headers: string[], rows: string[][]): string {
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000"
const FULL_HEADERS = ["従業員ID", "従業員名", "フリガナ", "入社日", "退職日", "グループ"]
const REQUIRED_HEADERS = ["従業員ID", "従業員名", "フリガナ", "入社日", "退職日"]

describe("parseEmployeeCsv", () => {
  describe("ヘッダー検証", () => {
    it("全ヘッダーがある場合は有効", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "", "営業部"],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.headerValid).toBe(true)
      expect(result.rows).toHaveLength(1)
    })

    it("グループ列なし（必須ヘッダーのみ）でも有効", () => {
      const csv = buildCsv(REQUIRED_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.headerValid).toBe(true)
    })

    it("必須ヘッダーが欠けている場合はエラー", () => {
      const csv = buildCsv(["従業員ID", "従業員名"], [
        [VALID_UUID, "田中太郎"],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.headerValid).toBe(false)
      expect(result.headerError).toContain("フリガナ")
    })

    it("空のCSVはエラー", () => {
      const result = parseEmployeeCsv("")
      expect(result.headerValid).toBe(false)
      expect(result.headerError).toContain("空")
    })

    it("ヘッダー行のみの場合は空の行配列を返す", () => {
      const csv = FULL_HEADERS.join(",")
      const result = parseEmployeeCsv(csv)
      expect(result.headerValid).toBe(true)
      expect(result.rows).toHaveLength(0)
    })
  })

  describe("日付変換", () => {
    it("yyyy/MM/dd 形式を yyyy-MM-dd に変換", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "2025/03/31", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.hireDate).toBe("2020-04-01")
      expect(result.rows[0].data.terminationDate).toBe("2025-03-31")
    })

    it("yyyy-MM-dd 形式もそのまま変換", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020-4-1", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.hireDate).toBe("2020-04-01")
    })

    it("空の日付はnullに変換", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].data.hireDate).toBeNull()
      expect(result.rows[0].data.terminationDate).toBeNull()
    })

    it("不正な日付形式はエラー", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "20200401", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("入社日")
    })

    it("退職日の形式が不正な場合もエラー", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "invalid", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("退職日")
    })
  })

  describe("空フィールド・バリデーション", () => {
    it("従業員名が空の場合はエラー", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "", "タナカタロウ", "2020/04/01", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("従業員名")
    })

    it("従業員IDが空の場合はnull（新規追加）", () => {
      const csv = buildCsv(FULL_HEADERS, [
        ["", "田中太郎", "タナカタロウ", "2020/04/01", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.employeeId).toBeNull()
    })

    it("不正なUUID形式の従業員IDはエラー", () => {
      const csv = buildCsv(FULL_HEADERS, [
        ["invalid-uuid", "田中太郎", "タナカタロウ", "2020/04/01", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(false)
    })

    it("フリガナが空の場合はnull（有効）", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "", "2020/04/01", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data.nameKana).toBeNull()
    })
  })

  describe("グループ列", () => {
    it("グループ名が正しくパースされる", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "", "営業部"],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].data.groupNames).toBe("営業部")
    })

    it("複数グループ（|区切り）が正しくパースされる", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "", "営業部|開発部"],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].data.groupNames).toBe("営業部|開発部")
    })

    it("グループ列が空の場合はnull", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].data.groupNames).toBeNull()
    })

    it("グループ列がないCSVでもgroupNamesは空文字からnullになる", () => {
      const csv = buildCsv(REQUIRED_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].data.groupNames).toBeNull()
    })
  })

  describe("複数行", () => {
    it("有効行と無効行が混在するCSVを正しく処理", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "", "営業部"],
        ["", "", "サトウ", "2021/04/01", "", ""],
        ["", "佐藤花子", "サトウハナコ", "2021/04/01", "", "開発部"],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows).toHaveLength(3)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[1].valid).toBe(false) // 従業員名が空
      expect(result.rows[2].valid).toBe(true)
    })

    it("行番号が正しく設定される（1-based、ヘッダー含む）", () => {
      const csv = buildCsv(FULL_HEADERS, [
        [VALID_UUID, "田中太郎", "タナカタロウ", "2020/04/01", "", ""],
        ["", "佐藤花子", "サトウハナコ", "2021/04/01", "", ""],
      ])
      const result = parseEmployeeCsv(csv)
      expect(result.rows[0].rowIndex).toBe(2)
      expect(result.rows[1].rowIndex).toBe(3)
    })
  })
})
