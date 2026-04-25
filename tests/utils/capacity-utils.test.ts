import { describe, it, expect } from "vitest"
import {
  getTimeHHMM,
  isTimeInRange,
  isDutyActive,
  isWorkerPresent,
  calculateCapacity,
  calculateFilteredCapacity,
  extractFilterOptions,
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

describe("calculateCapacity", () => {
  const makeShift = (employeeId: string, start: string, end: string) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
  })

  const makeDuty = (employeeId: string, start: string, end: string, reducesCapacity = true) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    reducesCapacity,
  })

  it("通常ケース: 出勤中の人から当番中を引いた数が対応可能", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),
      makeShift("emp-2", "09:00", "17:00"),
      makeShift("emp-3", "09:00", "17:00"),
    ]
    const duties = [makeDuty("emp-1", "09:00", "12:00")]
    const result = calculateCapacity(shifts, duties, "10:00")
    expect(result).toEqual({ total: 3, onDuty: 1, available: 2 })
  })

  it("出勤時間外の人はカウントしない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),  // 出勤中
      makeShift("emp-2", "13:00", "22:00"),  // まだ出勤前
    ]
    const result = calculateCapacity(shifts, [], "10:00")
    expect(result).toEqual({ total: 1, onDuty: 0, available: 1 })
  })

  it("退勤後の人はカウントしない", () => {
    const shifts = [
      makeShift("emp-1", "06:00", "14:00"),  // まだ出勤中
      makeShift("emp-2", "06:00", "12:00"),  // 退勤済み
    ]
    const result = calculateCapacity(shifts, [], "13:00")
    expect(result).toEqual({ total: 1, onDuty: 0, available: 1 })
  })

  it("当番なし: 出勤中全員が対応可能", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),
      makeShift("emp-2", "09:00", "17:00"),
    ]
    const result = calculateCapacity(shifts, [], "10:00")
    expect(result).toEqual({ total: 2, onDuty: 0, available: 2 })
  })

  it("全員が当番中: 対応可能 0", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),
      makeShift("emp-2", "09:00", "17:00"),
    ]
    const duties = [
      makeDuty("emp-1", "09:00", "17:00"),
      makeDuty("emp-2", "09:00", "17:00"),
    ]
    const result = calculateCapacity(shifts, duties, "10:00")
    expect(result).toEqual({ total: 2, onDuty: 2, available: 0 })
  })

  it("同一従業員の複数当番: 二重カウントしない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),
      makeShift("emp-2", "09:00", "17:00"),
    ]
    const duties = [
      makeDuty("emp-1", "09:00", "12:00"),
      makeDuty("emp-1", "09:00", "12:00"),
    ]
    const result = calculateCapacity(shifts, duties, "10:00")
    expect(result).toEqual({ total: 2, onDuty: 1, available: 1 })
  })

  it("出勤中でない人の当番はカウントしない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),  // 出勤中
      makeShift("emp-2", "13:00", "22:00"),  // 未出勤
    ]
    const duties = [
      makeDuty("emp-2", "09:00", "17:00"),  // 未出勤者の当番
    ]
    const result = calculateCapacity(shifts, duties, "10:00")
    expect(result).toEqual({ total: 1, onDuty: 0, available: 1 })
  })

  it("シフトなし: 全て 0", () => {
    const result = calculateCapacity([], [], "10:00")
    expect(result).toEqual({ total: 0, onDuty: 0, available: 0 })
  })

  it("employeeId が null のシフトは無視する", () => {
    const shifts = [
      { employeeId: null, startTime: "1970-01-01T09:00:00Z", endTime: "1970-01-01T17:00:00Z" },
      makeShift("emp-1", "09:00", "17:00"),
    ]
    const result = calculateCapacity(shifts, [], "10:00")
    expect(result).toEqual({ total: 1, onDuty: 0, available: 1 })
  })

  it("夜勤 22:00〜08:00: 23:00時点で夜勤者は出勤中", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),  // 退勤済み
      makeShift("emp-2", "22:00", "08:00"),  // 夜勤中
    ]
    const result = calculateCapacity(shifts, [], "23:00")
    expect(result).toEqual({ total: 1, onDuty: 0, available: 1 })
  })

  it("夜勤 22:00〜08:00: 03:00時点で夜勤者は出勤中", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00"),  // 夜勤中
      makeShift("emp-2", "22:00", "08:00"),  // 夜勤中
    ]
    const duties = [makeDuty("emp-1", "22:00", "08:00")]
    const result = calculateCapacity(shifts, duties, "03:00")
    expect(result).toEqual({ total: 2, onDuty: 1, available: 1 })
  })

  it("日勤と夜勤の混在: 10:00時点", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),  // 日勤 出勤中
      makeShift("emp-2", "09:00", "17:00"),  // 日勤 出勤中
      makeShift("emp-3", "22:00", "08:00"),  // 夜勤 退勤済み
    ]
    const result = calculateCapacity(shifts, [], "10:00")
    expect(result).toEqual({ total: 2, onDuty: 0, available: 2 })
  })

  it("日勤と夜勤の混在: 22:30時点", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),  // 日勤 退勤済み
      makeShift("emp-2", "22:00", "08:00"),  // 夜勤 出勤中
      makeShift("emp-3", "21:00", "08:00"),  // 夜勤 出勤中
    ]
    const result = calculateCapacity(shifts, [], "22:30")
    expect(result).toEqual({ total: 2, onDuty: 0, available: 2 })
  })

  it("reducesCapacity=false の当番は控除しない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),
      makeShift("emp-2", "09:00", "17:00"),
    ]
    const duties = [
      makeDuty("emp-1", "09:00", "12:00", false),  // 控除しない（直着当番等）
    ]
    const result = calculateCapacity(shifts, duties, "10:00")
    expect(result).toEqual({ total: 2, onDuty: 0, available: 2 })
  })

  it("reducesCapacity=true の当番のみ控除する", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00"),
      makeShift("emp-2", "09:00", "17:00"),
      makeShift("emp-3", "09:00", "17:00"),
    ]
    const duties = [
      makeDuty("emp-1", "09:00", "12:00", true),   // 控除する（資料作成等）
      makeDuty("emp-2", "09:00", "12:00", false),  // 控除しない（直着当番等）
    ]
    const result = calculateCapacity(shifts, duties, "10:00")
    expect(result).toEqual({ total: 3, onDuty: 1, available: 2 })
  })
})

describe("calculateFilteredCapacity", () => {
  const groupA = { id: 1, name: "グループA" }
  const groupB = { id: 2, name: "グループB" }

  const makeShift = (
    employeeId: string, start: string, end: string,
    groups: Array<{ id: number; name: string }>,
    roles: Array<{ kind: "SUPERVISOR" | "BUSINESS" | "OTHER"; roleName: string }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    groups,
    roles,
  })

  const makeDuty = (employeeId: string, start: string, end: string, reducesCapacity = true) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    reducesCapacity,
  })

  it("フィルターなし: 全員の集計", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA]),
      makeShift("emp-2", "09:00", "17:00", [groupB]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ total: 2, onDuty: 0, onLunch: 0, available: 2 })
  })

  it("グループフィルター: 該当グループの人だけ集計", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA]),
      makeShift("emp-2", "09:00", "17:00", [groupA]),
      makeShift("emp-3", "09:00", "17:00", [groupB]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00", { groupIds: [1] })
    expect(result).toMatchObject({ total: 2, onDuty: 0, onLunch: 0, available: 2 })
  })

  it("ロールフィルター: 該当ロールの人だけ集計", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [], [{ kind: "BUSINESS", roleName: "電話対応" }]),
      makeShift("emp-2", "09:00", "17:00", [], [{ kind: "BUSINESS", roleName: "窓口対応" }]),
      makeShift("emp-3", "09:00", "17:00", [], []),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00", {
      roleNames: { BUSINESS: ["電話対応"] },
    })
    expect(result).toMatchObject({ total: 1, onDuty: 0, onLunch: 0, available: 1 })
  })

  it("グループ + ロールの複合フィルター: AND条件", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA], [{ kind: "BUSINESS", roleName: "電話対応" }]),
      makeShift("emp-2", "09:00", "17:00", [groupA], [{ kind: "BUSINESS", roleName: "窓口対応" }]),
      makeShift("emp-3", "09:00", "17:00", [groupB], [{ kind: "BUSINESS", roleName: "電話対応" }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00", {
      groupIds: [1],
      roleNames: { BUSINESS: ["電話対応"] },
    })
    expect(result).toMatchObject({ total: 1, onDuty: 0, onLunch: 0, available: 1 })
  })

  it("フィルター + 当番: 当番中の人が正しくカウントされる", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA]),
      makeShift("emp-2", "09:00", "17:00", [groupA]),
    ]
    const duties = [makeDuty("emp-1", "09:00", "12:00")]
    const result = calculateFilteredCapacity(shifts, duties, "10:00", { groupIds: [1] })
    expect(result).toMatchObject({ total: 2, onDuty: 1, onLunch: 0, available: 1 })
  })

  it("該当者なしのフィルター: 全て 0", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00", { groupIds: [999] })
    expect(result).toMatchObject({ total: 0, onDuty: 0, onLunch: 0, available: 0 })
  })

  it("出勤時間外の人はフィルター結果に含まれない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA]),
      makeShift("emp-2", "13:00", "22:00", [groupA]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00", { groupIds: [1] })
    expect(result.total).toBe(1)
  })

  it("reducesCapacity=false の当番はフィルター結果でも控除しない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [groupA]),
      makeShift("emp-2", "09:00", "17:00", [groupA]),
    ]
    const duties = [
      makeDuty("emp-1", "09:00", "12:00", false),
    ]
    const result = calculateFilteredCapacity(shifts, duties, "10:00", { groupIds: [1] })
    expect(result).toMatchObject({ total: 2, onDuty: 0, onLunch: 0, available: 2 })
  })
})

describe("calculateFilteredCapacity - SV人数カウント", () => {
  // today in JST: use a fixed past date string for startDate/endDate comparisons
  // Since getTodayJSTDateStr() uses real time, we use clearly past/future dates
  const PAST = "2000-01-01T00:00:00.000Z"    // definitely before today
  const FUTURE = "2099-12-31T00:00:00.000Z"   // definitely after today

  const makeShiftWithRoles = (
    employeeId: string,
    roles: Array<{ kind: "SUPERVISOR" | "BUSINESS" | "OTHER"; roleName: string; startDate?: string | null; endDate?: string | null }>
  ) => ({
    employeeId,
    startTime: "1970-01-01T09:00:00Z",
    endTime: "1970-01-01T17:00:00Z",
    groups: [],
    roles,
  })

  it("SUPERVISOR ロール保持者がいない: svTotal=0, svAvailable=0", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "BUSINESS", roleName: "電話対応" }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 0, svAvailable: 0 })
  })

  it("日付なし（常時有効）のSVはカウントされる", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: null, endDate: null }]),
      makeShiftWithRoles("emp-2", [{ kind: "BUSINESS", roleName: "電話対応" }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 1, svAvailable: 1 })
  })

  it("startDate が今日より未来のSVはカウントされない", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: FUTURE, endDate: null }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 0, svAvailable: 0 })
  })

  it("endDate が今日より過去のSVはカウントされない", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: PAST, endDate: PAST }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 0, svAvailable: 0 })
  })

  it("startDate〜endDate が今日を含む有効期間のSVはカウントされる", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: PAST, endDate: FUTURE }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 1, svAvailable: 1 })
  })

  it("startDate が Date オブジェクト（過去）でもカウントされる", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: new Date(PAST), endDate: null }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 1, svAvailable: 1 })
  })

  it("endDate が Date オブジェクト（未来）でもカウントされる", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: null, endDate: new Date(FUTURE) }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 1, svAvailable: 1 })
  })

  it("endDate が Date オブジェクト（過去）の場合はカウントされない", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV", startDate: null, endDate: new Date(PAST) }]),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ svTotal: 0, svAvailable: 0 })
  })

  it("当番中のSVは svAvailable に含まれない", () => {
    const shifts = [
      makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV" }]),
      makeShiftWithRoles("emp-2", [{ kind: "SUPERVISOR", roleName: "SV" }]),
    ]
    const duties = [{
      employeeId: "emp-1",
      startTime: "1970-01-01T09:00:00Z",
      endTime: "1970-01-01T17:00:00Z",
      reducesCapacity: true,
    }]
    const result = calculateFilteredCapacity(shifts, duties, "10:00")
    expect(result).toMatchObject({ svTotal: 2, svAvailable: 1 })
  })

  it("フィルター後の対象者のみSVカウント", () => {
    const groupA = { id: 1, name: "A" }
    const groupB = { id: 2, name: "B" }
    const shifts = [
      { ...makeShiftWithRoles("emp-1", [{ kind: "SUPERVISOR", roleName: "SV" }]), groups: [groupA] },
      { ...makeShiftWithRoles("emp-2", [{ kind: "SUPERVISOR", roleName: "SV" }]), groups: [groupB] },
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00", { groupIds: [1] })
    expect(result).toMatchObject({ total: 1, svTotal: 1, svAvailable: 1 })
  })
})

describe("calculateFilteredCapacity - isYesterdayOvernight フラグ", () => {
  const makeShift = (
    employeeId: string, start: string, end: string,
    groups: Array<{ id: number; name: string }> = [],
    roles: Array<{ kind: "SUPERVISOR" | "BUSINESS" | "OTHER"; roleName: string }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    groups,
    roles,
  })

  it("昨日の夜勤（22:00-08:00）は22:05にはカウントしない", () => {
    const shifts = [
      { ...makeShift("emp-1", "22:00", "08:00"), isYesterdayOvernight: true },
    ]
    const result = calculateFilteredCapacity(shifts, [], "22:05")
    expect(result.total).toBe(0)
  })

  it("昨日の夜勤（22:00-08:00）は04:00にはカウントする", () => {
    const shifts = [
      { ...makeShift("emp-1", "22:00", "08:00"), isYesterdayOvernight: true },
    ]
    const result = calculateFilteredCapacity(shifts, [], "04:00")
    expect(result.total).toBe(1)
  })

  it("昨日の夜勤（22:00-08:00）は08:00（終了時刻）にはカウントする", () => {
    const shifts = [
      { ...makeShift("emp-1", "22:00", "08:00"), isYesterdayOvernight: true },
    ]
    const result = calculateFilteredCapacity(shifts, [], "08:00")
    expect(result.total).toBe(1)
  })

  it("昨日の夜勤（22:00-08:00）は08:01にはカウントしない", () => {
    const shifts = [
      { ...makeShift("emp-1", "22:00", "08:00"), isYesterdayOvernight: true },
    ]
    const result = calculateFilteredCapacity(shifts, [], "08:01")
    expect(result.total).toBe(0)
  })

  it("昨日の夜勤者（終業済み）と今日の夜勤者が混在: 22:05は今日の夜勤者のみカウント", () => {
    const shifts = [
      { ...makeShift("emp-1", "22:00", "08:00"), isYesterdayOvernight: true },  // 昨日の夜勤 → 終業済み
      makeShift("emp-2", "22:00", "08:00"),  // 今日の夜勤 → 出勤中
    ]
    const result = calculateFilteredCapacity(shifts, [], "22:05")
    expect(result.total).toBe(1)
  })

  it("今日の夜勤（isYesterdayOvernight なし）は22:05にもカウントする", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00"),  // 今日の夜勤（フラグなし）
    ]
    const result = calculateFilteredCapacity(shifts, [], "22:05")
    expect(result.total).toBe(1)
  })
})

describe("calculateFilteredCapacity - 今日の夜勤シフト誤カウント修正", () => {
  const makeShift = (
    employeeId: string, start: string, end: string,
    groups: Array<{ id: number; name: string }> = [],
    roles: Array<{ kind: "SUPERVISOR" | "BUSINESS" | "OTHER"; roleName: string; startDate?: string | null; endDate?: string | null }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    groups,
    roles,
  })

  it("今日の夜勤（22:00-08:00）は07:00時点でカウントしない", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00"),
    ]
    const result = calculateFilteredCapacity(shifts, [], "07:00")
    expect(result.total).toBe(0)
  })

  it("今日の夜勤（22:00-08:00）は22:00（開始時刻）からカウントする", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00"),
    ]
    const result = calculateFilteredCapacity(shifts, [], "22:00")
    expect(result.total).toBe(1)
  })

  it("今日の夜勤（22:00-08:00）は22:30時点でカウントする", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00"),
    ]
    const result = calculateFilteredCapacity(shifts, [], "22:30")
    expect(result.total).toBe(1)
  })

  it("バグ再現: 早番SV2名 + 今日の夜勤SV2名の07:00時点では早番2名のみカウントされる", () => {
    // 報告バグ: 07:00頃に2名のはずが4名（SV: 2）と表示されていた
    // 原因: 今日の夜勤（22:00-08:00）のSVが07:00に誤ってカウントされていた
    const svRole = [{ kind: "SUPERVISOR", roleName: "SV", startDate: null, endDate: null }]
    const shifts = [
      makeShift("emp-1", "06:00", "14:00", [], svRole),  // 早番SV 出勤中
      makeShift("emp-2", "06:00", "14:00", [], svRole),  // 早番SV 出勤中
      makeShift("emp-3", "22:00", "08:00", [], svRole),  // 今日の夜勤SV → まだ出勤前
      makeShift("emp-4", "22:00", "08:00", [], svRole),  // 今日の夜勤SV → まだ出勤前
    ]
    const result = calculateFilteredCapacity(shifts, [], "07:00")
    expect(result.total).toBe(2)
    expect(result.svTotal).toBe(2)
    expect(result.svAvailable).toBe(2)
  })

  it("早番 + 今日の夜勤の混在: 07:00時点では早番者のみカウントされる", () => {
    const shifts = [
      makeShift("emp-1", "06:00", "14:00"),  // 早番 出勤中
      makeShift("emp-2", "06:00", "14:00"),  // 早番 出勤中
      makeShift("emp-3", "22:00", "08:00"),  // 今日の夜勤 → まだ出勤前
      makeShift("emp-4", "22:00", "08:00"),  // 今日の夜勤 → まだ出勤前
    ]
    const result = calculateFilteredCapacity(shifts, [], "07:00")
    expect(result.total).toBe(2)
    expect(result.available).toBe(2)
  })
})

describe("extractFilterOptions - isYesterdayOvernight フラグ", () => {
  const makeShift = (
    employeeId: string, start: string, end: string,
    groups: Array<{ id: number; name: string }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    groups,
    roles: [],
  })

  it("昨日の夜勤（終業済み）の人はフィルター選択肢に含まれない", () => {
    const shifts = [
      { ...makeShift("emp-1", "22:00", "08:00", [{ id: 1, name: "グループA" }]), isYesterdayOvernight: true },  // 終業済み
      makeShift("emp-2", "22:00", "08:00", [{ id: 2, name: "グループB" }]),  // 今日の夜勤 → 出勤中
    ]
    const result = extractFilterOptions(shifts, "22:05")
    expect(result.groups).toEqual([{ id: 2, name: "グループB" }])
  })
})

describe("extractFilterOptions - 今日の夜勤シフト誤カウント修正", () => {
  const makeShift = (
    employeeId: string, start: string, end: string,
    groups: Array<{ id: number; name: string }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    groups,
    roles: [],
  })

  it("今日の夜勤（22:00-08:00）の人は07:00時点でフィルター選択肢に含まれない", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00", [{ id: 1, name: "グループA" }]),  // 今日の夜勤 → まだ出勤前
      makeShift("emp-2", "06:00", "14:00", [{ id: 2, name: "グループB" }]),  // 早番 出勤中
    ]
    const result = extractFilterOptions(shifts, "07:00")
    expect(result.groups).toEqual([{ id: 2, name: "グループB" }])
  })

  it("今日の夜勤（22:00-08:00）の人は22:00（開始時刻）からフィルター選択肢に含まれる", () => {
    const shifts = [
      makeShift("emp-1", "22:00", "08:00", [{ id: 1, name: "グループA" }]),
    ]
    const result = extractFilterOptions(shifts, "22:00")
    expect(result.groups).toEqual([{ id: 1, name: "グループA" }])
  })
})

describe("extractFilterOptions", () => {
  const makeShift = (
    employeeId: string, start: string, end: string,
    groups: Array<{ id: number; name: string }>,
    roles: Array<{ kind: "SUPERVISOR" | "BUSINESS" | "OTHER"; roleName: string }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    groups,
    roles,
  })

  it("出勤中の従業員からグループとロールの選択肢を抽出する", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [{ id: 1, name: "A" }], [{ kind: "SUPERVISOR", roleName: "主任" }]),
      makeShift("emp-2", "09:00", "17:00", [{ id: 2, name: "B" }], [{ kind: "BUSINESS", roleName: "電話対応" }]),
    ]
    const result = extractFilterOptions(shifts, "10:00")
    expect(result.groups).toEqual([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ])
    expect(result.roles).toEqual({
      SUPERVISOR: ["主任"],
      BUSINESS: ["電話対応"],
    })
  })

  it("出勤時間外の人の選択肢は含まれない", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [{ id: 1, name: "A" }]),
      makeShift("emp-2", "13:00", "22:00", [{ id: 2, name: "B" }]),
    ]
    const result = extractFilterOptions(shifts, "10:00")
    expect(result.groups).toEqual([{ id: 1, name: "A" }])
  })

  it("重複は排除される", () => {
    const shifts = [
      makeShift("emp-1", "09:00", "17:00", [{ id: 1, name: "A" }], [{ kind: "BUSINESS", roleName: "電話対応" }]),
      makeShift("emp-2", "09:00", "17:00", [{ id: 1, name: "A" }], [{ kind: "BUSINESS", roleName: "電話対応" }]),
    ]
    const result = extractFilterOptions(shifts, "10:00")
    expect(result.groups).toHaveLength(1)
    expect(result.roles.BUSINESS).toHaveLength(1)
  })
})

describe("calculateFilteredCapacity - 昼休憩の整合性", () => {
  const groupA = { id: 1, name: "グループA" }

  const makeShiftWithLunch = (
    employeeId: string, start: string, end: string,
    lunchStart: string | null, lunchEnd: string | null,
    groups: Array<{ id: number; name: string }> = [],
    roles: Array<{ kind: "SUPERVISOR" | "BUSINESS" | "OTHER"; roleName: string; startDate?: string | null; endDate?: string | null }> = []
  ) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    lunchBreakStart: lunchStart ? `1970-01-01T${lunchStart}:00Z` : null,
    lunchBreakEnd: lunchEnd ? `1970-01-01T${lunchEnd}:00Z` : null,
    groups,
    roles,
  })

  const makeDuty = (employeeId: string, start: string, end: string, reducesCapacity = true) => ({
    employeeId,
    startTime: `1970-01-01T${start}:00Z`,
    endTime: `1970-01-01T${end}:00Z`,
    reducesCapacity,
  })

  it("昼休憩中の従業員は total に含まれ、onLunch にカウントされる", () => {
    const shifts = [
      makeShiftWithLunch("emp-1", "09:00", "17:00", "12:00", "13:00"),
      makeShiftWithLunch("emp-2", "09:00", "17:00", "12:00", "13:00"),
    ]
    const result = calculateFilteredCapacity(shifts, [], "12:30")
    expect(result).toMatchObject({ total: 2, onLunch: 2, onDuty: 0, available: 0 })
  })

  it("昼休憩時間外の従業員は onLunch に含まれない", () => {
    const shifts = [
      makeShiftWithLunch("emp-1", "09:00", "17:00", "12:00", "13:00"),
      makeShiftWithLunch("emp-2", "09:00", "17:00", "12:00", "13:00"),
    ]
    const result = calculateFilteredCapacity(shifts, [], "10:00")
    expect(result).toMatchObject({ total: 2, onLunch: 0, onDuty: 0, available: 2 })
  })

  it("一部が昼休憩中: 混在ケース", () => {
    const shifts = [
      makeShiftWithLunch("emp-1", "09:00", "17:00", "12:00", "13:00"),
      makeShiftWithLunch("emp-2", "09:00", "17:00", "13:00", "14:00"), // まだ昼休憩前
    ]
    const result = calculateFilteredCapacity(shifts, [], "12:30")
    expect(result).toMatchObject({ total: 2, onLunch: 1, onDuty: 0, available: 1 })
  })

  it("昼休憩中かつ他業務中: 二重控除しない（和集合）", () => {
    const shifts = [
      makeShiftWithLunch("emp-1", "09:00", "17:00", "12:00", "13:00"),
      makeShiftWithLunch("emp-2", "09:00", "17:00", null, null),
    ]
    const duties = [makeDuty("emp-1", "11:00", "14:00")]
    const result = calculateFilteredCapacity(shifts, duties, "12:30")
    // emp-1: 昼休憩中 AND 当番中 → 1人分のみ控除
    // emp-2: 通常勤務
    expect(result).toMatchObject({ total: 2, onLunch: 1, onDuty: 1, available: 1 })
  })

  it("昼休憩中のSVは svTotal に含まれ svAvailable に含まれない", () => {
    const svRole = [{ kind: "SUPERVISOR", roleName: "SV", startDate: null, endDate: null }]
    const shifts = [
      makeShiftWithLunch("emp-1", "09:00", "17:00", "12:00", "13:00", [], svRole),
      makeShiftWithLunch("emp-2", "09:00", "17:00", null, null, [], svRole),
    ]
    const result = calculateFilteredCapacity(shifts, [], "12:30")
    expect(result).toMatchObject({ svTotal: 2, svAvailable: 1 })
  })

  it("昼休憩データがない従業員は onLunch=0", () => {
    const shifts = [
      makeShiftWithLunch("emp-1", "09:00", "17:00", null, null),
    ]
    const result = calculateFilteredCapacity(shifts, [], "12:30")
    expect(result).toMatchObject({ total: 1, onLunch: 0, available: 1 })
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
