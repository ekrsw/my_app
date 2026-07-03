import { describe, it, expect } from "vitest"
import {
  formatDate,
  formatTime,
  formatMonth,
  formatDateShort,
  getDaysInMonth,
  getDayOfWeekJa,
  toDateString,
  formatDateForInput,
  getTodayJST,
} from "@/lib/date-utils"

// asUTC を通す formatDate/formatTime は「UTC 成分で構築した Date」を渡すと
// テスト機のタイムゾーンに依存せず DB の JST 値をそのまま出力する（lib/date-utils.ts の asUTC コメント参照）。
// 一方 formatMonth/formatDateShort/getDayOfWeekJa/toDateString/getDaysInMonth は
// 生の format（ローカル時刻）を使うため、ローカルコンストラクタ new Date(y, m, d) で構築する。

describe("formatDate — asUTC 経由の日付整形", () => {
  it("null は '-' を返す", () => {
    expect(formatDate(null)).toBe("-")
  })

  it("UTC 成分で構築した Date を yyyy/MM/dd で整形する", () => {
    expect(formatDate(new Date(Date.UTC(2026, 5, 15)))).toBe("2026/06/15")
  })

  it("カスタムパターンを適用できる", () => {
    expect(formatDate(new Date(Date.UTC(2026, 5, 15)), "yyyy年M月d日")).toBe(
      "2026年6月15日"
    )
  })

  it("Z 付き ISO 文字列を parseISO 経由で整形する", () => {
    expect(formatDate("2026-06-15T00:00:00Z")).toBe("2026/06/15")
  })

  // 回帰テスト: 日付のみ "YYYY-MM-DD" 文字列（ShiftDetailDialog が渡す形式）。
  // 修正前は parseISO がローカル 0 時と解釈し、JST 環境で asUTC が前日を読んで
  // 1 日ずれていた（vitest は TZ=Asia/Tokyo 固定なので、このずれを確実に検出する）。
  it("日付のみ文字列 'YYYY-MM-DD' を 1 日ずらさず整形する", () => {
    expect(formatDate("2026-07-03")).toBe("2026/07/03")
  })

  it("日付のみ文字列を ShiftDetailDialog のパターンで整形する", () => {
    expect(formatDate("2026-07-03", "yyyy年M月d日(E)")).toBe("2026年7月3日(金)")
  })

  it("日付のみ文字列が月初でも前月末にずれない", () => {
    expect(formatDate("2026-01-01")).toBe("2026/01/01")
  })

  it("日付のみ文字列が年末でも翌年にずれない", () => {
    expect(formatDate("2026-12-31")).toBe("2026/12/31")
  })

  it("DB の JST 値（Prisma が UTC として読む timestamp）を二重補正せず出力する", () => {
    // 2026/12/31 を表す DB 値は UTC 成分 12/31 として渡ってくる
    expect(formatDate(new Date(Date.UTC(2026, 11, 31)))).toBe("2026/12/31")
  })
})

describe("formatTime — asUTC 経由の時刻整形", () => {
  it("null は '-' を返す", () => {
    expect(formatTime(null)).toBe("-")
  })

  it("UTC 成分の時刻を HH:mm で返す", () => {
    expect(formatTime(new Date(Date.UTC(2026, 5, 15, 9, 30)))).toBe("09:30")
  })

  it("Z 付き ISO 文字列から HH:mm を返す", () => {
    expect(formatTime("2026-06-15T22:05:00Z")).toBe("22:05")
  })

  it("真夜中を 00:00 で返す", () => {
    expect(formatTime(new Date(Date.UTC(2026, 5, 15, 0, 0)))).toBe("00:00")
  })
})

describe("formatMonth — yyyy年M月", () => {
  it("ローカル Date を yyyy年M月 で返す", () => {
    expect(formatMonth(new Date(2026, 5, 1))).toBe("2026年6月")
  })

  it("1月（month=0）を正しく表示する", () => {
    expect(formatMonth(new Date(2026, 0, 1))).toBe("2026年1月")
  })
})

describe("formatDateShort — M/d(曜日)", () => {
  it("月曜を (月) 付きで返す", () => {
    expect(formatDateShort(new Date(2026, 5, 15))).toBe("6/15(月)")
  })

  it("日曜を (日) 付きで返す", () => {
    expect(formatDateShort(new Date(2026, 5, 14))).toBe("6/14(日)")
  })
})

describe("getDaysInMonth — 月内の全日付", () => {
  it("2026年6月は 30 日分返す", () => {
    const days = getDaysInMonth(2026, 6)
    expect(days).toHaveLength(30)
    expect(days[0].getDate()).toBe(1)
    expect(days[days.length - 1].getDate()).toBe(30)
  })

  it("2026年2月（非うるう年）は 28 日", () => {
    expect(getDaysInMonth(2026, 2)).toHaveLength(28)
  })

  it("2024年2月（うるう年）は 29 日", () => {
    expect(getDaysInMonth(2024, 2)).toHaveLength(29)
  })
})

describe("getDayOfWeekJa — 曜日 1 文字", () => {
  it("月曜は '月'", () => {
    expect(getDayOfWeekJa(new Date(2026, 5, 15))).toBe("月")
  })

  it("日曜は '日'", () => {
    expect(getDayOfWeekJa(new Date(2026, 5, 14))).toBe("日")
  })
})

describe("toDateString — yyyy-MM-dd（ローカル）", () => {
  it("ローカル Date を yyyy-MM-dd で返す", () => {
    expect(toDateString(new Date(2026, 5, 15))).toBe("2026-06-15")
  })

  it("月・日をゼロ埋めする", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05")
  })
})

describe("formatDateForInput — input[type=date] 用 yyyy-MM-dd", () => {
  it("null は空文字を返す", () => {
    expect(formatDateForInput(null)).toBe("")
  })

  it("undefined は空文字を返す", () => {
    expect(formatDateForInput(undefined)).toBe("")
  })

  it("不正な日付文字列は空文字を返す", () => {
    expect(formatDateForInput("not-a-date")).toBe("")
  })

  it("UTC 成分で構築した Date を yyyy-MM-dd で返す", () => {
    expect(formatDateForInput(new Date(Date.UTC(2026, 5, 15)))).toBe("2026-06-15")
  })

  it("日付文字列をそのまま yyyy-MM-dd で返す", () => {
    expect(formatDateForInput("2026-06-15")).toBe("2026-06-15")
  })
})

describe("getTodayJST — JST 基準の UTC midnight", () => {
  it("UTC midnight（時分秒ミリ秒すべて 0）を返す", () => {
    const today = getTodayJST()
    expect(today.getUTCHours()).toBe(0)
    expect(today.getUTCMinutes()).toBe(0)
    expect(today.getUTCSeconds()).toBe(0)
    expect(today.getUTCMilliseconds()).toBe(0)
  })

  it("JST で算出した今日の年月日と一致する", () => {
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const expected = new Date(
      Date.UTC(
        jstNow.getUTCFullYear(),
        jstNow.getUTCMonth(),
        jstNow.getUTCDate()
      )
    )
    expect(getTodayJST().getTime()).toBe(expected.getTime())
  })
})
