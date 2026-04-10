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
  getDutyAssignmentsForDaily,
  getDutyAssignmentsForCalendar,
  getDutyDailyFilterOptions,
} = await import("@/lib/db/duty-assignments")

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

describe("getDutyAssignmentsForDaily", () => {
  let employeeId1: string
  let employeeId2: string
  let dutyTypeId1: number
  let dutyTypeId2: number
  let groupId: number

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()

    const emp1 = await prisma.employee.create({ data: { name: "山田太郎" } })
    const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
    employeeId1 = emp1.id
    employeeId2 = emp2.id

    const group = await prisma.group.create({ data: { name: "A班" } })
    groupId = group.id
    await prisma.employeeGroup.create({
      data: { employeeId: employeeId1, groupId, startDate: null, endDate: null },
    })

    const dt1 = await prisma.dutyType.create({
      data: { name: "日勤", sortOrder: 1 },
    })
    const dt2 = await prisma.dutyType.create({
      data: { name: "夜勤", sortOrder: 2 },
    })
    dutyTypeId1 = dt1.id
    dutyTypeId2 = dt2.id

    // 2件の業務割当を作成
    await prisma.dutyAssignment.create({
      data: {
        employeeId: employeeId1,
        dutyTypeId: dutyTypeId1,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: employeeId2,
        dutyTypeId: dutyTypeId2,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T17:00:00Z"),
        endTime: new Date("1970-01-01T09:00:00Z"),
        reducesCapacity: false,
      },
    })
  })

  it("全件取得（フィルターなし）", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })

  it("ページネーション: pageSize=1 → hasMore=true", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY },
      { cursor: 0, pageSize: 1 }
    )
    expect(result.data).toHaveLength(1)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe(1)
  })

  it("ページネーション: cursor=1, pageSize=1 → 2件目取得", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY },
      { cursor: 1, pageSize: 1 }
    )
    expect(result.data).toHaveLength(1)
    expect(result.hasMore).toBe(false)
  })

  it("employeeIdsフィルター", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY, employeeIds: [employeeId1] },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(employeeId1)
  })

  it("groupIdsフィルター", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY, groupIds: [groupId] },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(employeeId1)
  })

  it("dutyTypeIdsフィルター", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY, dutyTypeIds: [dutyTypeId2] },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0].dutyTypeId).toBe(dutyTypeId2)
  })

  it("reducesCapacityフィルター", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY, reducesCapacity: false },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0].reducesCapacity).toBe(false)
  })

  it("データなしの日付 → 空配列", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: utcDate("2025-01-01") },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it("ソート: employeeName", async () => {
    const result = await getDutyAssignmentsForDaily(
      { date: MOCK_TODAY, sortBy: "employeeName", sortOrder: "asc" },
      { cursor: 0, pageSize: 50 }
    )
    expect(result.data[0].employee.name).toBe("佐藤花子")
    expect(result.data[1].employee.name).toBe("山田太郎")
  })
})

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

describe("getDutyDailyFilterOptions", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()

    const emp = await prisma.employee.create({ data: { name: "鈴木次郎" } })
    const group = await prisma.group.create({ data: { name: "C班" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: null, endDate: null },
    })
    const dt = await prisma.dutyType.create({
      data: { name: "日勤", sortOrder: 1 },
    })

    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id,
        dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
  })

  it("フィルター選択肢を返す", async () => {
    const options = await getDutyDailyFilterOptions(MOCK_TODAY)
    expect(options.employees).toHaveLength(1)
    expect(options.employees[0].name).toBe("鈴木次郎")
    expect(options.groups).toHaveLength(1)
    expect(options.groups[0].name).toBe("C班")
    expect(options.dutyTypes).toHaveLength(1)
    expect(options.dutyTypes[0].name).toBe("日勤")
  })

  it("データなし → 空配列", async () => {
    const options = await getDutyDailyFilterOptions(utcDate("2025-01-01"))
    expect(options.employees).toHaveLength(0)
    expect(options.groups).toHaveLength(0)
    expect(options.dutyTypes).toHaveLength(0)
  })
})
