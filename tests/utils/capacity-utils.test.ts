import { describe, it, expect } from "vitest"
import {
  getTimeHHMM,
  isTimeInRange,
  isDutyActive,
  isWorkerPresent,
  getCapacityColor,
} from "@/lib/capacity-utils"

describe("getTimeHHMM", () => {
  it("Date オブジェクトから HH:mm を抽出する", () => {
    const d = new Date("1970-01-01T09:30:00.000Z")
    expect(getTimeHHMM(d)).toBe("09:30")
  })

  it("ISO 文字列から HH:mm を抽出する", () => {
    expect(getTimeHHMM("1970-01-01T14:00:00.000Z")).toBe("14:00")
  })

  it("真夜中を正しく処理する", () => {
    expect(getTimeHHMM("1970-01-01T00:00:00.000Z")).toBe("00:00")
  })

  it("23:59 を正しく処理する", () => {
    expect(getTimeHHMM("1970-01-01T23:59:00.000Z")).toBe("23:59")
  })
})

describe("isTimeInRange", () => {
  it("通常範囲: 範囲内", () => {
    expect(isTimeInRange("09:00", "17:00", "12:00")).toBe(true)
  })

  it("通常範囲: 範囲外", () => {
    expect(isTimeInRange("09:00", "17:00", "18:00")).toBe(false)
  })

  it("深夜跨ぎ: 22:00〜08:00 の間（23:00）", () => {
    expect(isTimeInRange("22:00", "08:00", "23:00")).toBe(true)
  })

  it("深夜跨ぎ: 22:00〜08:00 の間（02:00）", () => {
    expect(isTimeInRange("22:00", "08:00", "02:00")).toBe(true)
  })

  it("深夜跨ぎ: 22:00〜08:00 の範囲外（12:00）", () => {
    expect(isTimeInRange("22:00", "08:00", "12:00")).toBe(false)
  })

  it("深夜跨ぎ: 22:00〜08:00 の範囲外（10:00）", () => {
    expect(isTimeInRange("22:00", "08:00", "10:00")).toBe(false)
  })

  it("深夜跨ぎ: 21:00〜08:00 の間（00:00）", () => {
    expect(isTimeInRange("21:00", "08:00", "00:00")).toBe(true)
  })

  it("深夜跨ぎ: 境界値 ちょうど開始時刻", () => {
    expect(isTimeInRange("22:00", "08:00", "22:00")).toBe(true)
  })

  it("深夜跨ぎ: 境界値 ちょうど終了時刻", () => {
    expect(isTimeInRange("22:00", "08:00", "08:00")).toBe(true)
  })

  it("深夜跨ぎ: 開始直前は範囲外", () => {
    expect(isTimeInRange("22:00", "08:00", "21:59")).toBe(false)
  })

  it("深夜跨ぎ: 終了直後は範囲外", () => {
    expect(isTimeInRange("22:00", "08:00", "08:01")).toBe(false)
  })
})

describe("isDutyActive", () => {
  it("時間範囲内ならアクティブ", () => {
    expect(isDutyActive("1970-01-01T09:00:00Z", "1970-01-01T12:00:00Z", "10:30")).toBe(true)
  })

  it("時間範囲外ならアクティブでない", () => {
    expect(isDutyActive("1970-01-01T09:00:00Z", "1970-01-01T12:00:00Z", "13:00")).toBe(false)
  })

  it("開始前ならアクティブでない", () => {
    expect(isDutyActive("1970-01-01T09:00:00Z", "1970-01-01T12:00:00Z", "08:59")).toBe(false)
  })

  it("境界値: ちょうど開始時刻ならアクティブ", () => {
    expect(isDutyActive("1970-01-01T09:00:00Z", "1970-01-01T12:00:00Z", "09:00")).toBe(true)
  })

  it("境界値: ちょうど終了時刻ならアクティブ", () => {
    expect(isDutyActive("1970-01-01T09:00:00Z", "1970-01-01T12:00:00Z", "12:00")).toBe(true)
  })

  it("Date オブジェクトでも動作する", () => {
    const start = new Date("1970-01-01T09:00:00Z")
    const end = new Date("1970-01-01T12:00:00Z")
    expect(isDutyActive(start, end, "10:00")).toBe(true)
  })
})

describe("isWorkerPresent", () => {
  it("出勤時間内なら出勤中", () => {
    expect(isWorkerPresent("1970-01-01T09:00:00Z", "1970-01-01T17:00:00Z", "12:00")).toBe(true)
  })

  it("出勤前なら出勤中でない", () => {
    expect(isWorkerPresent("1970-01-01T13:00:00Z", "1970-01-01T22:00:00Z", "10:00")).toBe(false)
  })

  it("退勤後なら出勤中でない", () => {
    expect(isWorkerPresent("1970-01-01T09:00:00Z", "1970-01-01T17:00:00Z", "18:00")).toBe(false)
  })

  it("境界値: ちょうど出勤時刻なら出勤中", () => {
    expect(isWorkerPresent("1970-01-01T09:00:00Z", "1970-01-01T17:00:00Z", "09:00")).toBe(true)
  })

  it("境界値: ちょうど退勤時刻なら出勤中", () => {
    expect(isWorkerPresent("1970-01-01T09:00:00Z", "1970-01-01T17:00:00Z", "17:00")).toBe(true)
  })

  it("startTime が null なら出勤中でない", () => {
    expect(isWorkerPresent(null, "1970-01-01T17:00:00Z", "12:00")).toBe(false)
  })

  it("endTime が null なら出勤開始以降ずっと出勤中", () => {
    expect(isWorkerPresent("1970-01-01T09:00:00Z", null, "12:00")).toBe(true)
    expect(isWorkerPresent("1970-01-01T09:00:00Z", null, "08:00")).toBe(false)
  })

  it("夜勤 22:00〜08:00: 23:00は出勤中", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "23:00")).toBe(true)
  })

  it("夜勤 22:00〜08:00: 03:00は出勤中", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "03:00")).toBe(true)
  })

  it("夜勤 22:00〜08:00: 10:00は出勤中でない", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "10:00")).toBe(false)
  })

  it("夜勤 21:00〜08:00: 00:00は出勤中", () => {
    expect(isWorkerPresent("1970-01-01T21:00:00Z", "1970-01-01T08:00:00Z", "00:00")).toBe(true)
  })

  it("夜勤 22:00〜08:00: 15:00は出勤中でない", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "15:00")).toBe(false)
  })
})

describe("isWorkerPresent - forTodayShift フラグ（今日の夜勤判定）", () => {
  it("forTodayShift=true: 夜勤 22:00〜08:00 の07:00は出勤中でない（修正前はtrueになるバグがあった）", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "07:00", true)).toBe(false)
  })

  it("forTodayShift=true: 夜勤 22:00〜08:00 の22:00（開始時刻）は出勤中", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "22:00", true)).toBe(true)
  })

  it("forTodayShift=true: 夜勤 22:00〜08:00 の23:00は出勤中", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "23:00", true)).toBe(true)
  })

  it("forTodayShift=true: 夜勤 22:00〜08:00 の21:59（開始直前）は出勤中でない", () => {
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "21:59", true)).toBe(false)
  })

  it("forTodayShift=true: 通常シフト 09:00〜17:00 の挙動は変わらない", () => {
    expect(isWorkerPresent("1970-01-01T09:00:00Z", "1970-01-01T17:00:00Z", "12:00", true)).toBe(true)
    expect(isWorkerPresent("1970-01-01T09:00:00Z", "1970-01-01T17:00:00Z", "18:00", true)).toBe(false)
  })

  it("forTodayShift 未指定: 夜勤 22:00〜08:00 の07:00は出勤中（深夜跨ぎロジック適用・既存挙動維持）", () => {
    // forTodayShift を省略すると isTimeInRange の深夜跨ぎロジックが適用され 07:00 は true になる
    // getPreviousDayOvernightShifts（isYesterdayOvernight=true）で使用される挙動
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "07:00")).toBe(true)
    expect(isWorkerPresent("1970-01-01T22:00:00Z", "1970-01-01T08:00:00Z", "07:00", false)).toBe(true)
  })
})

describe("getCapacityColor", () => {
  it("3人以上は緑", () => {
    expect(getCapacityColor(3)).toBe("green")
    expect(getCapacityColor(10)).toBe("green")
  })

  it("1-2人は黄", () => {
    expect(getCapacityColor(1)).toBe("yellow")
    expect(getCapacityColor(2)).toBe("yellow")
  })

  it("0人は赤", () => {
    expect(getCapacityColor(0)).toBe("red")
  })
})
