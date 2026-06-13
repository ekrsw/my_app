import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { getTodayJST } from "@/lib/date-utils"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getShiftsForCalendarPaginated, getCalendarEmployeeOptions } = await import(
  "@/lib/db/shifts"
)

// カレンダー系クエリのグループフィルタは「今日」基準で current 判定するため、
// 当月を対象にする（termination_date >= 月初 条件を満たすように）。
const today = getTodayJST()
const YEAR = today.getUTCFullYear()
const MONTH = today.getUTCMonth() + 1

describe("getShiftsForCalendarPaginated / getCalendarEmployeeOptions - グループ startDate=null 対応", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("getShiftsForCalendarPaginated: startDate=null のグループ所属者が groupId フィルタに含まれる", async () => {
    const groupA = await prisma.group.create({ data: { name: "A開発部" } })
    const groupB = await prisma.group.create({ data: { name: "B営業部" } })
    const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
    const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })

    // emp1: 開始日 NULL で groupA に所属
    await prisma.employeeGroup.create({
      data: { employeeId: emp1.id, groupId: groupA.id, startDate: null, endDate: null },
    })
    // emp2: groupB に所属（フィルタ対象外）
    await prisma.employeeGroup.create({
      data: { employeeId: emp2.id, groupId: groupB.id, startDate: null, endDate: null },
    })

    const result = await getShiftsForCalendarPaginated({
      year: YEAR,
      month: MONTH,
      groupIds: [groupA.id],
    })

    const ids = result.data.map((d) => d.employeeId)
    expect(ids).toContain(emp1.id)
    expect(ids).not.toContain(emp2.id)
  })

  it("getShiftsForCalendarPaginated: unassigned フィルタで startDate=null 所属者は未所属扱いされない", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const assigned = await prisma.employee.create({ data: { name: "所属あり太郎" } })
    const unassigned = await prisma.employee.create({ data: { name: "未所属花子" } })

    await prisma.employeeGroup.create({
      data: { employeeId: assigned.id, groupId: group.id, startDate: null, endDate: null },
    })

    const result = await getShiftsForCalendarPaginated({
      year: YEAR,
      month: MONTH,
      unassigned: true,
    })

    const ids = result.data.map((d) => d.employeeId)
    expect(ids).toContain(unassigned.id)
    // 開始日 NULL でも「現在所属している」ので未所属フィルタには含まれない
    expect(ids).not.toContain(assigned.id)
  })

  it("getShiftsForCalendarPaginated: 未来開始日のグループ所属者は groupId フィルタに含まれない", async () => {
    const group = await prisma.group.create({ data: { name: "未来開発部" } })
    const emp = await prisma.employee.create({ data: { name: "未来太郎" } })

    // 開始日が未来 → まだ所属開始していない（null-safe 化後も current 判定されないこと）
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: new Date("2099-01-01"), endDate: null },
    })

    const result = await getShiftsForCalendarPaginated({
      year: YEAR,
      month: MONTH,
      groupIds: [group.id],
    })

    expect(result.data.map((d) => d.employeeId)).not.toContain(emp.id)
  })

  it("getCalendarEmployeeOptions: startDate=null のグループ所属者が groupId フィルタに含まれる", async () => {
    const groupA = await prisma.group.create({ data: { name: "A開発部" } })
    const emp1 = await prisma.employee.create({ data: { name: "田中太郎" } })
    const emp2 = await prisma.employee.create({ data: { name: "佐藤花子" } })

    await prisma.employeeGroup.create({
      data: { employeeId: emp1.id, groupId: groupA.id, startDate: null, endDate: null },
    })
    // emp2 は未所属

    const options = await getCalendarEmployeeOptions({
      year: YEAR,
      month: MONTH,
      groupIds: [groupA.id],
    })

    const ids = options.map((o) => o.id)
    expect(ids).toContain(emp1.id)
    expect(ids).not.toContain(emp2.id)
  })

  it("getCalendarEmployeeOptions: unassigned フィルタで startDate=null 所属者は未所属扱いされない", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const assigned = await prisma.employee.create({ data: { name: "所属あり太郎" } })
    const unassigned = await prisma.employee.create({ data: { name: "未所属花子" } })

    await prisma.employeeGroup.create({
      data: { employeeId: assigned.id, groupId: group.id, startDate: null, endDate: null },
    })

    const options = await getCalendarEmployeeOptions({
      year: YEAR,
      month: MONTH,
      unassigned: true,
    })

    const ids = options.map((o) => o.id)
    expect(ids).toContain(unassigned.id)
    // 開始日 NULL でも現在所属しているので未所属フィルタには含まれない
    expect(ids).not.toContain(assigned.id)
  })
})
