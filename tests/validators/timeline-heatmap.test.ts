import { describe, it, expect } from "vitest"
import { isPresent, isPresentOvernight, generateTimeSlots, computeSlotStats, buildShiftDisplayMap, type MergedRow } from "@/components/dashboard/timeline-heatmap"
import type { TodayShift } from "@/components/dashboard/today-overview-client"
import type { DutyAssignmentWithDetails } from "@/types/duties"

// Prisma @db.Time(6) は 1970-01-01T{HH:mm:ss}Z 形式のDateオブジェクト
// getTimeHHMM はISOの11-16文字目(UTC部分)を抽出する
function time(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`)
}

describe("isPresent (ヒートマップ用在席判定)", () => {
  describe("通常シフト (start <= end)", () => {
    it("9:00-17:00 シフト: 勤務時間内のスロットはtrue", () => {
      expect(isPresent(time("09:00"), time("17:00"), "09:00")).toBe(true)
      expect(isPresent(time("09:00"), time("17:00"), "12:00")).toBe(true)
      expect(isPresent(time("09:00"), time("17:00"), "16:30")).toBe(true)
    })

    it("9:00-17:00 シフト: 終業時刻(17:00)のスロットはfalse", () => {
      expect(isPresent(time("09:00"), time("17:00"), "17:00")).toBe(false)
    })

    it("9:00-17:00 シフト: 勤務時間外のスロットはfalse", () => {
      expect(isPresent(time("09:00"), time("17:00"), "08:00")).toBe(false)
      expect(isPresent(time("09:00"), time("17:00"), "08:30")).toBe(false)
      expect(isPresent(time("09:00"), time("17:00"), "17:30")).toBe(false)
      expect(isPresent(time("09:00"), time("17:00"), "21:00")).toBe(false)
    })

    it("8:30-17:30 シフト: 境界値チェック", () => {
      expect(isPresent(time("08:30"), time("17:30"), "08:00")).toBe(false)
      expect(isPresent(time("08:30"), time("17:30"), "08:30")).toBe(true)
      expect(isPresent(time("08:30"), time("17:30"), "17:00")).toBe(true)
      expect(isPresent(time("08:30"), time("17:30"), "17:30")).toBe(false)
    })
  })

  describe("深夜跨ぎシフト (end < start)", () => {
    it("22:00-08:00 シフト: 8:00台のスロットはfalse（翌日側は含めない）", () => {
      expect(isPresent(time("22:00"), time("08:00"), "08:00")).toBe(false)
      expect(isPresent(time("22:00"), time("08:00"), "08:30")).toBe(false)
    })

    it("22:00-08:00 シフト: ヒートマップ範囲内の全スロットはfalse（22:00は範囲外）", () => {
      expect(isPresent(time("22:00"), time("08:00"), "09:00")).toBe(false)
      expect(isPresent(time("22:00"), time("08:00"), "12:00")).toBe(false)
      expect(isPresent(time("22:00"), time("08:00"), "21:30")).toBe(false)
    })

    it("20:00-04:00 シフト: 20:00以降のスロットはtrue", () => {
      expect(isPresent(time("20:00"), time("04:00"), "19:30")).toBe(false)
      expect(isPresent(time("20:00"), time("04:00"), "20:00")).toBe(true)
      expect(isPresent(time("20:00"), time("04:00"), "20:30")).toBe(true)
      expect(isPresent(time("20:00"), time("04:00"), "21:00")).toBe(true)
      expect(isPresent(time("20:00"), time("04:00"), "21:30")).toBe(true)
    })

    it("20:00-04:00 シフト: 08:00-19:30のスロットはfalse", () => {
      expect(isPresent(time("20:00"), time("04:00"), "08:00")).toBe(false)
      expect(isPresent(time("20:00"), time("04:00"), "12:00")).toBe(false)
      expect(isPresent(time("20:00"), time("04:00"), "19:30")).toBe(false)
    })
  })

  describe("null/境界ケース", () => {
    it("startTime=null → false", () => {
      expect(isPresent(null, null, "09:00")).toBe(false)
      expect(isPresent(null, time("17:00"), "09:00")).toBe(false)
    })

    it("endTime=null → startTime以降ならtrue", () => {
      expect(isPresent(time("09:00"), null, "08:30")).toBe(false)
      expect(isPresent(time("09:00"), null, "09:00")).toBe(true)
      expect(isPresent(time("09:00"), null, "21:30")).toBe(true)
    })
  })
})

describe("isPresentOvernight (前日夜勤の在席判定)", () => {
  it("endTime=08:00: 0:00-07:30はtrue, 08:00以降はfalse", () => {
    expect(isPresentOvernight(time("08:00"), "00:00")).toBe(true)
    expect(isPresentOvernight(time("08:00"), "04:00")).toBe(true)
    expect(isPresentOvernight(time("08:00"), "07:30")).toBe(true)
    expect(isPresentOvernight(time("08:00"), "08:00")).toBe(false)
    expect(isPresentOvernight(time("08:00"), "12:00")).toBe(false)
  })

  it("endTime=06:00: 0:00-05:30はtrue, 06:00以降はfalse", () => {
    expect(isPresentOvernight(time("06:00"), "00:00")).toBe(true)
    expect(isPresentOvernight(time("06:00"), "05:30")).toBe(true)
    expect(isPresentOvernight(time("06:00"), "06:00")).toBe(false)
  })

  it("endTime=00:00: すべてfalse（slot < '00:00' は成立しない）", () => {
    expect(isPresentOvernight(time("00:00"), "00:00")).toBe(false)
    expect(isPresentOvernight(time("00:00"), "08:00")).toBe(false)
  })

  it("endTime=null: false", () => {
    expect(isPresentOvernight(null, "04:00")).toBe(false)
  })
})

describe("generateTimeSlots", () => {
  it("8:00-22:00で28スロット生成", () => {
    const slots = generateTimeSlots(8, 22)
    expect(slots).toHaveLength(28)
    expect(slots[0]).toBe("08:00")
    expect(slots[slots.length - 1]).toBe("21:30")
  })

  it("0:00-24:00で48スロット生成", () => {
    const slots = generateTimeSlots(0, 24)
    expect(slots).toHaveLength(48)
    expect(slots[0]).toBe("00:00")
    expect(slots[slots.length - 1]).toBe("23:30")
  })
})

// computeSlotStats テスト用ヘルパー
const SLOTS_3 = ["09:00", "09:30", "10:00"] // 3スロットで十分

function makeRow(overrides: {
  employeeId: string
  presence: boolean[]
  lunchBreak: boolean[]
  svRoleType?: string
  roleStartDate?: string | null
  roleEndDate?: string | null
}): MergedRow {
  const functionRoles = overrides.svRoleType
    ? [{
        id: 1, employeeId: overrides.employeeId, functionRoleId: 1,
        roleType: overrides.svRoleType, isPrimary: true,
        startDate: overrides.roleStartDate ? new Date(overrides.roleStartDate) : null,
        endDate: overrides.roleEndDate ? new Date(overrides.roleEndDate) : null,
        functionRole: { id: 1, roleCode: "SV", roleName: "SV", roleType: overrides.svRoleType, isActive: true },
      }]
    : []
  return {
    employeeId: overrides.employeeId,
    employeeName: `Employee ${overrides.employeeId}`,
    employee: {
      id: overrides.employeeId,
      employeeNumber: "001",
      name: `Employee ${overrides.employeeId}`,
      email: null,
      hireDate: null,
      terminationDate: null,
      isActive: true,
      groups: [],
      functionRoles,
    } as MergedRow["employee"],
    presence: overrides.presence,
    lunchBreak: overrides.lunchBreak,
  }
}

function makeDuty(overrides: {
  employeeId: string
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  reducesCapacity?: boolean
}): DutyAssignmentWithDetails {
  return {
    id: Math.floor(Math.random() * 10000),
    employeeId: overrides.employeeId,
    dutyTypeId: 1,
    date: new Date("2026-04-14"),
    startTime: new Date(`1970-01-01T${overrides.startTime}:00.000Z`),
    endTime: new Date(`1970-01-01T${overrides.endTime}:00.000Z`),
    note: null,
    title: null,
    reducesCapacity: overrides.reducesCapacity ?? true,
    employee: { id: overrides.employeeId, employeeNumber: "001", name: "Emp", email: null, hireDate: null, terminationDate: null, isActive: true, groups: [] } as DutyAssignmentWithDetails["employee"],
    dutyType: { id: 1, name: "対応", color: null, defaultReducesCapacity: true, isActive: true, sortOrder: 0, defaultStartTime: null, defaultEndTime: null, defaultNote: null, defaultTitle: null },
  }
}

const ROLE_TYPES: readonly [string, string] = ["監督", "業務"]

describe("computeSlotStats", () => {
  it("presence=true → present にカウント", () => {
    const grid = [makeRow({ employeeId: "a", presence: [true, true, false], lunchBreak: [false, false, false] })]
    const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
    expect(stats[0].present).toBe(1)
    expect(stats[1].present).toBe(1)
    expect(stats[2].present).toBe(0)
  })

  it("lunchBreak=true → present にカウント & lunch にカウント", () => {
    const grid = [makeRow({ employeeId: "a", presence: [false, false, false], lunchBreak: [true, false, false] })]
    const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
    expect(stats[0].present).toBe(1)
    expect(stats[0].lunch).toBe(1)
    expect(stats[1].present).toBe(0)
  })

  it("SVロール有効期間内 → sv にカウント", () => {
    const grid = [makeRow({
      employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false],
      svRoleType: "監督", roleStartDate: "2020-01-01", roleEndDate: null,
    })]
    const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
    expect(stats[0].sv).toBe(1)
  })

  it("SVロール期限切れ → sv にカウントされない", () => {
    const grid = [makeRow({
      employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false],
      svRoleType: "監督", roleStartDate: "2020-01-01", roleEndDate: "2025-12-31",
    })]
    const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
    expect(stats[0].sv).toBe(0)
  })

  it("reducesCapacity=true の業務 → onDuty にカウント", () => {
    const grid = [makeRow({ employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false] })]
    const duties = [makeDuty({ employeeId: "a", startTime: "09:00", endTime: "10:00", reducesCapacity: true })]
    const stats = computeSlotStats(grid, SLOTS_3, duties, ROLE_TYPES)
    expect(stats[0].onDuty).toBe(1) // 09:00
    expect(stats[1].onDuty).toBe(1) // 09:30
    expect(stats[2].onDuty).toBe(0) // 10:00 (半開区間)
  })

  it("reducesCapacity=false の業務 → onDuty にカウントされない", () => {
    const grid = [makeRow({ employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false] })]
    const duties = [makeDuty({ employeeId: "a", startTime: "09:00", endTime: "10:00", reducesCapacity: false })]
    const stats = computeSlotStats(grid, SLOTS_3, duties, ROLE_TYPES)
    expect(stats[0].onDuty).toBe(0)
    expect(stats[1].onDuty).toBe(0)
  })

  it("日跨ぎ業務 (22:00-06:00) → start以降と翌日end未満のスロットでonDuty", () => {
    // showFullDay=true を想定: 0:00〜23:30 の範囲でテスト
    const slots = ["04:00", "05:30", "06:00", "21:00", "21:30", "22:00", "22:30", "23:00"]
    const grid = [makeRow({ employeeId: "a", presence: [true, true, false, false, false, true, true, true], lunchBreak: [false, false, false, false, false, false, false, false] })]
    const duties = [makeDuty({ employeeId: "a", startTime: "22:00", endTime: "06:00" })]
    const stats = computeSlotStats(grid, slots, duties, ROLE_TYPES)
    expect(stats[0].onDuty).toBe(1) // 04:00 (翌日側、slot < end)
    expect(stats[1].onDuty).toBe(1) // 05:30 (翌日側、slot < end)
    expect(stats[2].onDuty).toBe(0) // 06:00 (半開区間、end自体は含まない)
    expect(stats[3].onDuty).toBe(0) // 21:00
    expect(stats[4].onDuty).toBe(0) // 21:30
    expect(stats[5].onDuty).toBe(1) // 22:00
    expect(stats[6].onDuty).toBe(1) // 22:30
    expect(stats[7].onDuty).toBe(1) // 23:00
  })

  it("昼休憩×業務重複 → 二重控除されない", () => {
    // 従業員A: 昼休憩中かつ業務割当中
    const grid = [
      makeRow({ employeeId: "a", presence: [false, false, false], lunchBreak: [true, true, true] }),
      makeRow({ employeeId: "b", presence: [true, true, true], lunchBreak: [false, false, false] }),
    ]
    const duties = [makeDuty({ employeeId: "a", startTime: "09:00", endTime: "11:00" })]
    const stats = computeSlotStats(grid, SLOTS_3, duties, ROLE_TYPES)
    // present=2 (A: lunchBreak, B: presence)
    // A は lunch=true かつ onDuty=true → unavailable 1人
    // B は何もなし → available
    expect(stats[0].present).toBe(2)
    expect(stats[0].lunch).toBe(1)
    expect(stats[0].onDuty).toBe(1)
    expect(stats[0].available).toBe(1) // 2 - 1(unavailable) = 1、二重控除なし
  })

  it("available が負にならない（0にクランプ）", () => {
    const grid = [makeRow({ employeeId: "a", presence: [false], lunchBreak: [true] })]
    const duties = [makeDuty({ employeeId: "a", startTime: "09:00", endTime: "10:00" })]
    const stats = computeSlotStats(grid, ["09:00"], duties, ROLE_TYPES)
    expect(stats[0].available).toBe(0)
  })

  it("空の filteredGrid → 全スロット0", () => {
    const stats = computeSlotStats([], SLOTS_3, undefined, ROLE_TYPES)
    expect(stats).toHaveLength(3)
    for (const stat of stats) {
      expect(stat.present).toBe(0)
      expect(stat.sv).toBe(0)
      expect(stat.lunch).toBe(0)
      expect(stat.onDuty).toBe(0)
      expect(stat.available).toBe(0)
    }
  })

  it("duties=undefined → onDuty 全0", () => {
    const grid = [makeRow({ employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false] })]
    const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
    for (const stat of stats) {
      expect(stat.onDuty).toBe(0)
    }
  })

  describe("availableEmployees", () => {
    it("presence=true, 昼休憩なし, 業務割当なし → availableEmployees に含まれる", () => {
      const grid = [makeRow({ employeeId: "a", presence: [true, true, false], lunchBreak: [false, false, false] })]
      const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
      expect(stats[0].availableEmployees).toEqual([{ id: "a", name: "Employee a" }])
      expect(stats[1].availableEmployees).toEqual([{ id: "a", name: "Employee a" }])
      expect(stats[2].availableEmployees).toEqual([])
    })

    it("昼休憩中 → availableEmployees から除外される", () => {
      const grid = [makeRow({ employeeId: "a", presence: [false, false, false], lunchBreak: [true, false, false] })]
      const stats = computeSlotStats(grid, SLOTS_3, undefined, ROLE_TYPES)
      expect(stats[0].availableEmployees).toEqual([])
      expect(stats[0].present).toBe(1)
      expect(stats[0].lunch).toBe(1)
    })

    it("reducesCapacity=true の業務中 → availableEmployees から除外される", () => {
      const grid = [makeRow({ employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false] })]
      const duties = [makeDuty({ employeeId: "a", startTime: "09:00", endTime: "10:00", reducesCapacity: true })]
      const stats = computeSlotStats(grid, SLOTS_3, duties, ROLE_TYPES)
      expect(stats[0].availableEmployees).toEqual([]) // 09:00 業務中
      expect(stats[1].availableEmployees).toEqual([]) // 09:30 業務中
      expect(stats[2].availableEmployees).toEqual([{ id: "a", name: "Employee a" }]) // 10:00 業務外（半開区間）
    })

    it("reducesCapacity=false の業務中 → availableEmployees に含まれる", () => {
      const grid = [makeRow({ employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false] })]
      const duties = [makeDuty({ employeeId: "a", startTime: "09:00", endTime: "10:00", reducesCapacity: false })]
      const stats = computeSlotStats(grid, SLOTS_3, duties, ROLE_TYPES)
      expect(stats[0].availableEmployees).toEqual([{ id: "a", name: "Employee a" }])
    })

    it("available の人数と availableEmployees.length が一致する", () => {
      const grid = [
        makeRow({ employeeId: "a", presence: [true, true, true], lunchBreak: [false, false, false] }),
        makeRow({ employeeId: "b", presence: [false, false, false], lunchBreak: [true, true, true] }),
        makeRow({ employeeId: "c", presence: [true, true, true], lunchBreak: [false, false, false] }),
      ]
      const duties = [makeDuty({ employeeId: "c", startTime: "09:00", endTime: "09:30", reducesCapacity: true })]
      const stats = computeSlotStats(grid, SLOTS_3, duties, ROLE_TYPES)
      for (const stat of stats) {
        expect(stat.availableEmployees).toHaveLength(stat.available)
      }
    })

    it("複数従業員が同スロットで対応可能 → 全員収集される", () => {
      const grid = [
        makeRow({ employeeId: "a", presence: [true], lunchBreak: [false] }),
        makeRow({ employeeId: "b", presence: [true], lunchBreak: [false] }),
        makeRow({ employeeId: "c", presence: [true], lunchBreak: [false] }),
      ]
      const stats = computeSlotStats(grid, ["09:00"], undefined, ROLE_TYPES)
      expect(stats[0].availableEmployees).toEqual([
        { id: "a", name: "Employee a" },
        { id: "b", name: "Employee b" },
        { id: "c", name: "Employee c" },
      ])
    })

    it("空のグリッド → availableEmployees 全て空配列", () => {
      const stats = computeSlotStats([], SLOTS_3, undefined, ROLE_TYPES)
      for (const stat of stats) {
        expect(stat.availableEmployees).toEqual([])
      }
    })
  })
})

describe("buildShiftDisplayMap (タイムラインシフト列表示用マップ)", () => {
  function makeShift(empId: string, shiftCode: string, isRemote = false): TodayShift {
    return {
      id: Math.floor(Math.random() * 10000),
      employeeId: empId,
      shiftDate: new Date("2026-04-18"),
      shiftCode,
      startTime: null,
      endTime: null,
      isHoliday: null,
      isRemote,
      lunchBreakStart: null,
      lunchBreakEnd: null,
      employee: {
        id: empId,
        name: `emp-${empId}`,
        employeeNumber: empId,
        kanaName: null,
        positionId: null,
        hireDate: null,
        retireDate: null,
        color: null,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        groups: [],
        functionRoles: [],
      },
    } as unknown as TodayShift
  }

  it("今日のシフトと前日夜勤シフトの両方がある → 今日のシフトを返す", () => {
    const todayShift = makeShift("emp1", "10_17", false)
    const overnightShift = makeShift("emp1", "22_8", true)
    const map = buildShiftDisplayMap([todayShift], [overnightShift])
    expect(map.size).toBe(1)
    expect(map.get("emp1")?.shiftCode).toBe("10_17")
    expect(map.get("emp1")?.isRemote).toBe(false)
  })

  it("今日のシフトのみ → 今日のシフトを返す", () => {
    const todayShift = makeShift("emp1", "09_18", false)
    const map = buildShiftDisplayMap([todayShift], [])
    expect(map.size).toBe(1)
    expect(map.get("emp1")?.shiftCode).toBe("09_18")
  })

  it("前日夜勤のみ → 前日夜勤のシフトを返す", () => {
    const overnightShift = makeShift("emp2", "22_8", false)
    const map = buildShiftDisplayMap([], [overnightShift])
    expect(map.size).toBe(1)
    expect(map.get("emp2")?.shiftCode).toBe("22_8")
  })

  it("複数従業員混在: 今日と前日のそれぞれが正しくマージされる", () => {
    const todayOnly = makeShift("empA", "10_17", true)
    const overnightOnly = makeShift("empB", "22_8", false)
    const both_today = makeShift("empC", "09_18", false)
    const both_overnight = makeShift("empC", "22_8", true)
    const map = buildShiftDisplayMap([todayOnly, both_today], [overnightOnly, both_overnight])
    expect(map.size).toBe(3)
    expect(map.get("empA")?.shiftCode).toBe("10_17")
    expect(map.get("empA")?.isRemote).toBe(true)
    expect(map.get("empB")?.shiftCode).toBe("22_8")
    expect(map.get("empC")?.shiftCode).toBe("09_18") // today優先
    expect(map.get("empC")?.isRemote).toBe(false)
  })
})
