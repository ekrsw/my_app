import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getShiftsForDaily } = await import("@/lib/db/shifts")

const TEST_DATE = "2026-01-15"

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

describe("getShiftsForDaily - グループ名表示（startDate NULL 対応）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("startDate が NULL の場合、グループ名が表示される", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: null, endDate: null },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE })
    const row = result.data.find((d) => d.employeeId === emp.id)

    expect(row).toBeDefined()
    expect(row?.groupName).toBe("開発部")
  })

  it("startDate が対象日より過去の場合、グループ名が表示される", async () => {
    const group = await prisma.group.create({ data: { name: "営業部" } })
    const emp = await prisma.employee.create({ data: { name: "佐藤花子" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: utcDate("2025-01-01"), endDate: null },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE })
    const row = result.data.find((d) => d.employeeId === emp.id)

    expect(row).toBeDefined()
    expect(row?.groupName).toBe("営業部")
  })

  it("startDate が対象日より未来の場合、グループ名が表示されない", async () => {
    const group = await prisma.group.create({ data: { name: "総務部" } })
    const emp = await prisma.employee.create({ data: { name: "鈴木一郎" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: utcDate("2027-01-01"), endDate: null },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE })
    const row = result.data.find((d) => d.employeeId === emp.id)

    expect(row?.groupName).toBeNull()
  })

  it("endDate が過去の場合、グループ名が表示されない", async () => {
    const group = await prisma.group.create({ data: { name: "人事部" } })
    const emp = await prisma.employee.create({ data: { name: "山田三郎" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: utcDate("2025-01-01"), endDate: utcDate("2025-12-31") },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE })
    const row = result.data.find((d) => d.employeeId === emp.id)

    expect(row?.groupName).toBeNull()
  })

  it("endDate が対象日（境界値）の場合、グループ名が表示される", async () => {
    const group = await prisma.group.create({ data: { name: "情報部" } })
    const emp = await prisma.employee.create({ data: { name: "高橋次郎" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: utcDate("2025-01-01"), endDate: utcDate(TEST_DATE) },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE })
    const row = result.data.find((d) => d.employeeId === emp.id)

    expect(row?.groupName).toBe("情報部")
  })

  it("startDate が対象日（境界値）の場合、グループ名が表示される", async () => {
    const group = await prisma.group.create({ data: { name: "広報部" } })
    const emp = await prisma.employee.create({ data: { name: "伊藤四郎" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: utcDate(TEST_DATE), endDate: null },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE })
    const row = result.data.find((d) => d.employeeId === emp.id)

    expect(row?.groupName).toBe("広報部")
  })
})

describe("getShiftsForDaily - グループフィルター（startDate NULL 対応）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("startDate が NULL の従業員を groupId でフィルタリングできる", async () => {
    const groupA = await prisma.group.create({ data: { name: "A開発部" } })
    const groupB = await prisma.group.create({ data: { name: "B営業部" } })
    const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
    const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })

    // emp1: startDate NULL で groupA に所属
    await prisma.employeeGroup.create({
      data: { employeeId: emp1.id, groupId: groupA.id, startDate: null, endDate: null },
    })
    // emp2: startDate 過去 で groupB に所属
    await prisma.employeeGroup.create({
      data: { employeeId: emp2.id, groupId: groupB.id, startDate: utcDate("2025-01-01"), endDate: null },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE, groupIds: [groupA.id] })

    const ids = result.data.map((d) => d.employeeId)
    expect(ids).toContain(emp1.id)
    expect(ids).not.toContain(emp2.id)
  })

  it("startDate が NULL かつ endDate が過去の場合、グループフィルターに引っかからない", async () => {
    // startDate が NULL かつ endDate が過去 → 現在は所属していない
    const group = await prisma.group.create({ data: { name: "旧部署" } })
    const emp = await prisma.employee.create({ data: { name: "退職済み田中" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: null, endDate: utcDate("2025-06-30") },
    })

    const result = await getShiftsForDaily({ date: TEST_DATE, groupIds: [group.id] })

    expect(result.data.map((d) => d.employeeId)).not.toContain(emp.id)
  })
})
