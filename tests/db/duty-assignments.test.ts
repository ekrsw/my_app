import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const MOCK_TODAY = new Date("2025-06-15T00:00:00.000Z")

vi.mock("@/lib/date-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/date-utils")>()
  return {
    ...original,
    getTodayJST: () => MOCK_TODAY,
  }
})

const {
  getDutyAssignmentsForCalendar,
  getDailyDutyAssignments,
  getPreviousDayOvernightDutyAssignments,
} = await import("@/lib/db/duty-assignments")

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

describe("getDutyAssignmentsForCalendar", () => {
  let employeeId: string
  let dutyTypeId: number

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()

    const emp = await prisma.employee.create({ data: { name: "田中一郎" } })
    employeeId = emp.id

    const dt = await prisma.dutyType.create({
      data: { name: "日勤", sortOrder: 1 },
    })
    dutyTypeId = dt.id

    // 6月1日と6月15日に割当
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-01"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-15"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
  })

  it("従業員×日マトリクスを構築", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeName).toBe("田中一郎")
    expect(Object.keys(result.data[0].duties)).toHaveLength(2)
    expect(result.data[0].duties["2025-06-01"]).toHaveLength(1)
    expect(result.data[0].duties["2025-06-15"]).toHaveLength(1)

    // セルに note フィールドが含まれること
    const cell = result.data[0].duties["2025-06-01"][0]
    expect(cell).toHaveProperty("note")
    expect(cell.note).toBeNull()
  })

  it("note 付き割当がセルに反映される", async () => {
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-20"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: false,
        note: "テストメモ",
      },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const cell = result.data[0].duties["2025-06-20"]?.[0]
    expect(cell).toBeDefined()
    expect(cell.note).toBe("テストメモ")
  })

  it("title 付き割当がセルに反映される", async () => {
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-21"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        title: "A社訪問",
      },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const cell = result.data[0].duties["2025-06-21"]?.[0]
    expect(cell).toBeDefined()
    expect(cell.title).toBe("A社訪問")
  })

  it("title なし割当のセルは null", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const cell = result.data[0].duties["2025-06-01"]?.[0]
    expect(cell).toBeDefined()
    expect(cell.title).toBeNull()
  })

  it("dutyTypeSummary に集計データ", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.dutyTypeSummary).toHaveLength(1)
    expect(result.dutyTypeSummary[0].name).toBe("日勤")
    expect(result.dutyTypeSummary[0].count).toBe(2)
  })

  it("データなしの月 → 従業員は返るがdutiesは空", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 1 })
    expect(result.data).toHaveLength(1)
    expect(Object.keys(result.data[0].duties)).toHaveLength(0)
    expect(result.dutyTypeSummary).toHaveLength(0)
  })

  it("groupIdsフィルター", async () => {
    const group = await prisma.group.create({ data: { name: "B班" } })
    await prisma.employeeGroup.create({
      data: { employeeId, groupId: group.id, startDate: null, endDate: null },
    })

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [group.id] })
    expect(result.data).toHaveLength(1)

    const resultEmpty = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [9999] })
    expect(resultEmpty.data).toHaveLength(0)
  })
})

describe("getDailyDutyAssignments", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()
  })

  it("指定日の業務割当のみ返す(任意日付)", async () => {
    const emp = await prisma.employee.create({ data: { name: "山田太郎" } })
    const dt = await prisma.dutyType.create({
      data: { name: "日勤", sortOrder: 1 },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: utcDate("2025-03-10"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })

    const pastResult = await getDailyDutyAssignments(utcDate("2025-03-10"))
    expect(pastResult).toHaveLength(1)
    expect(pastResult[0].employee.name).toBe("山田太郎")

    const todayResult = await getDailyDutyAssignments(MOCK_TODAY)
    expect(todayResult).toHaveLength(1)

    const futureResult = await getDailyDutyAssignments(utcDate("2026-12-01"))
    expect(futureResult).toHaveLength(0)
  })

  it("terminationDate が指定日より前の従業員は除外", async () => {
    const empActive = await prisma.employee.create({ data: { name: "現職者" } })
    const empTerminated = await prisma.employee.create({
      data: { name: "退職者", terminationDate: utcDate("2025-05-01") },
    })
    const dt = await prisma.dutyType.create({ data: { name: "日勤", sortOrder: 1 } })

    // 両者とも 2025-06-15 の割当を持つ (MOCK_TODAY)
    for (const emp of [empActive, empTerminated]) {
      await prisma.dutyAssignment.create({
        data: {
          employeeId: emp.id, dutyTypeId: dt.id,
          dutyDate: MOCK_TODAY,
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
          reducesCapacity: true,
        },
      })
    }

    const result = await getDailyDutyAssignments(MOCK_TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].employee.name).toBe("現職者")
  })

  it("startTime昇順 → 従業員名昇順でソート", async () => {
    const emp1 = await prisma.employee.create({ data: { name: "佐藤" } })
    const emp2 = await prisma.employee.create({ data: { name: "鈴木" } })
    const dt = await prisma.dutyType.create({ data: { name: "日勤", sortOrder: 1 } })

    // 佐藤: 10:00開始、鈴木: 09:00開始 → 鈴木が先
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp1.id, dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T10:00:00Z"),
        endTime: new Date("1970-01-01T18:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp2.id, dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })

    const result = await getDailyDutyAssignments(MOCK_TODAY)
    expect(result).toHaveLength(2)
    expect(result[0].employee.name).toBe("鈴木")
    expect(result[1].employee.name).toBe("佐藤")
  })
})

describe("getPreviousDayOvernightDutyAssignments", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()
  })

  it("指定日の前日(=date-1)の夜勤業務のみ返す", async () => {
    const emp = await prisma.employee.create({ data: { name: "夜勤者" } })
    const dt = await prisma.dutyType.create({ data: { name: "夜勤", sortOrder: 1 } })

    // 過去日 (2025-03-10) の前日 = 2025-03-09 に夜勤
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: utcDate("2025-03-09"),
        startTime: new Date("1970-01-01T22:00:00Z"),
        endTime: new Date("1970-01-01T08:00:00Z"), // 翌朝まで
        reducesCapacity: true,
      },
    })

    const pastResult = await getPreviousDayOvernightDutyAssignments(utcDate("2025-03-10"))
    expect(pastResult).toHaveLength(1)

    // 2025-03-11 を渡すと前日=2025-03-10 → 夜勤なし
    const otherResult = await getPreviousDayOvernightDutyAssignments(utcDate("2025-03-11"))
    expect(otherResult).toHaveLength(0)
  })

  it("非深夜跨ぎは除外 (startTime <= endTime)", async () => {
    const emp = await prisma.employee.create({ data: { name: "日勤者" } })
    const dt = await prisma.dutyType.create({ data: { name: "日勤", sortOrder: 1 } })

    // 前日(2025-06-14)の日勤(9-17) — 深夜跨ぎではない
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: utcDate("2025-06-14"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })

    const result = await getPreviousDayOvernightDutyAssignments(MOCK_TODAY)
    expect(result).toHaveLength(0)
  })
})

