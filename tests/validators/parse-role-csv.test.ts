import { describe, it, expect } from "vitest"
import { parseRoleCsv } from "@/lib/csv/parse-role-csv"

function buildCsv(headers: string[], rows: string[][]): string {
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
}

const HEADERS = ["従業員名", "ロールコード", "主担当", "開始日", "終了日"]

describe("parseRoleCsv", () => {
  describe("ヘッダー検証", () => {
    it("正常なヘッダーで有効", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "true", "2026/04/01", ""]])
      const result = parseRoleCsv(csv)
      expect(result.headerValid).toBe(true)
      expect(result.rows).toHaveLength(1)
    })

    it("空CSVでエラー", () => {
      const result = parseRoleCsv("")
      expect(result.headerValid).toBe(false)
      expect(result.headerError).toBe("CSVが空です")
    })

    it("ヘッダー不足でエラー", () => {
      const csv = buildCsv(["従業員名", "ロールコード"], [["山田太郎", "LEADER"]])
      const result = parseRoleCsv(csv)
      expect(result.headerValid).toBe(false)
      expect(result.headerError).toContain("必須ヘッダーがありません")
      expect(result.headerError).toContain("主担当")
    })
  })

  describe("行パース", () => {
    it("正常な行を正しくパースする", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "true", "2026/04/01", "2027/03/31"]])
      const result = parseRoleCsv(csv)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[0].data).toEqual({
        employeeName: "山田太郎",
        roleCode: "LEADER",
        isPrimary: true,
        startDate: "2026-04-01",
        endDate: "2027-03-31",
      })
    })

    it("複数行をパースする", () => {
      const csv = buildCsv(HEADERS, [
        ["山田太郎", "LEADER", "true", "2026/04/01", ""],
        ["田中花子", "OPERATOR", "false", "2026/04/01", ""],
      ])
      const result = parseRoleCsv(csv)
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0].valid).toBe(true)
      expect(result.rows[1].valid).toBe(true)
    })

    it("従業員名が空の行はエラー", () => {
      const csv = buildCsv(HEADERS, [["", "LEADER", "true", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("従業員名は必須です")
    })

    it("ロールコードが空の行はエラー", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "", "true", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("ロールコードは必須です")
    })
  })

  describe("isPrimary変換", () => {
    it("'true'をtrueに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "true", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.isPrimary).toBe(true)
    })

    it("'TRUE'をtrueに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "TRUE", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.isPrimary).toBe(true)
    })

    it("'1'をtrueに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "1", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.isPrimary).toBe(true)
    })

    it("'false'をfalseに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "false", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.isPrimary).toBe(false)
    })

    it("空文字をfalseに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.isPrimary).toBe(false)
    })

    it("その他の値をfalseに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "yes", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.isPrimary).toBe(false)
    })
  })

  describe("roleCode大文字正規化", () => {
    it("小文字を大文字に変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "leader", "false", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.roleCode).toBe("LEADER")
    })

    it("混在を大文字に変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "Leader", "false", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.roleCode).toBe("LEADER")
    })
  })

  describe("日付変換", () => {
    it("yyyy/MM/dd形式を変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "false", "2026/04/01", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.startDate).toBe("2026-04-01")
    })

    it("yyyy-MM-dd形式を変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "false", "2026-04-01", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.startDate).toBe("2026-04-01")
    })

    it("空文字はnullに変換", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "false", "", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].data.startDate).toBeNull()
      expect(result.rows[0].data.endDate).toBeNull()
    })

    it("不正な日付形式はエラー", () => {
      const csv = buildCsv(HEADERS, [["山田太郎", "LEADER", "false", "2026年4月1日", ""]])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].valid).toBe(false)
      expect(result.rows[0].error).toContain("開始日の形式が不正です")
    })
  })

  describe("rowIndex", () => {
    it("行番号は2から始まる（ヘッダー行=1）", () => {
      const csv = buildCsv(HEADERS, [
        ["山田太郎", "LEADER", "true", "", ""],
        ["田中花子", "OPERATOR", "false", "", ""],
      ])
      const result = parseRoleCsv(csv)
      expect(result.rows[0].rowIndex).toBe(2)
      expect(result.rows[1].rowIndex).toBe(3)
    })
  })
})
