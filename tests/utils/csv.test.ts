import { describe, it, expect } from "vitest"
import { rowsToCsv } from "@/lib/csv"

describe("rowsToCsv", () => {
  it("通常の値はクォートで囲んで出力する", () => {
    const csv = rowsToCsv([
      ["名前", "グループ"],
      ["田中太郎", "開発部"],
    ])
    expect(csv).toBe('"名前","グループ"\n"田中太郎","開発部"')
  })

  it("数値も文字列としてクォートする", () => {
    expect(rowsToCsv([[1, 2]])).toBe('"1","2"')
  })

  it("セル内のダブルクォートを二重化してエスケープする", () => {
    expect(rowsToCsv([['say "hi"']])).toBe('"say ""hi"""')
  })

  // CSV インジェクション中和: 先頭が数式トリガー文字なら ' を前置する
  it.each(["=", "+", "-", "@"])(
    "先頭が %s で始まる値は ' を前置して数式評価を防ぐ",
    (trigger) => {
      const csv = rowsToCsv([[`${trigger}HYPERLINK("http://evil")`]])
      expect(csv).toBe(`"'${trigger}HYPERLINK(""http://evil"")"`)
    },
  )

  it("先頭がタブ/CRの値も中和する", () => {
    expect(rowsToCsv([["\tcmd"]])).toBe('"\'\tcmd"')
    expect(rowsToCsv([["\rcmd"]])).toBe('"\'\rcmd"')
  })

  it("中間に数式トリガー文字があっても中和しない", () => {
    expect(rowsToCsv([["A=B"]])).toBe('"A=B"')
  })

  it("空文字セルはそのままクォートする", () => {
    expect(rowsToCsv([["", "x"]])).toBe('"","x"')
  })
})
