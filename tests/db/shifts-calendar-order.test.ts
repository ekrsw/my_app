import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getShiftsForCalendarPaginated } = await import("@/lib/db/shifts")

describe("getShiftsForCalendarPaginated - グループ名順ソート", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  const year = 2026
  const month = 3

  async function createGroupedEmployees() {
    // グループ作成（名前のアルファベット順: A営業部 < B開発部 < C総務部）
    const groupA = await prisma.group.create({ data: { name: "A営業部" } })
    const groupB = await prisma.group.create({ data: { name: "B開発部" } })
    const groupC = await prisma.group.create({ data: { name: "C総務部" } })

    // 従業員作成（ASCII前置でソート順を確定、グループ順と意図的に異なる作成順）
    const emp1 = await prisma.employee.create({ data: { name: "D田中太郎" } }) // → C総務部
    const emp2 = await prisma.employee.create({ data: { name: "A佐藤花子" } }) // → A営業部
    const emp3 = await prisma.employee.create({ data: { name: "C鈴木一郎" } }) // → B開発部
    const emp4 = await prisma.employee.create({ data: { name: "B高橋次郎" } }) // → A営業部
    const emp5 = await prisma.employee.create({ data: { name: "E山田三郎" } }) // → 未所属

    // グループ割り当て
    const today = new Date(Date.UTC(2026, 0, 1))
    await prisma.employeeGroup.createMany({
      data: [
        { employeeId: emp2.id, groupId: groupA.id, startDate: today },
        { employeeId: emp4.id, groupId: groupA.id, startDate: today },
        { employeeId: emp3.id, groupId: groupB.id, startDate: today },
        { employeeId: emp1.id, groupId: groupC.id, startDate: today },
      ],
    })

    return { groupA, groupB, groupC, emp1, emp2, emp3, emp4, emp5 }
  }

  it("グループ名順→従業員名順で返ること", async () => {
    const { emp1, emp2, emp3, emp4, emp5 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 50 }
    )

    // 期待順序: A営業部(A佐藤花子, B高橋次郎) → B開発部(C鈴木一郎) → C総務部(D田中太郎) → 未所属(E山田三郎)
    expect(result.data.map((d) => d.employeeId)).toEqual([
      emp2.id, // A営業部 A佐藤花子
      emp4.id, // A営業部 B高橋次郎
      emp3.id, // B開発部 C鈴木一郎
      emp1.id, // C総務部 D田中太郎
      emp5.id, // 未所属 E山田三郎
    ])
  })

  it("未所属従業員が末尾に来ること", async () => {
    const { emp5 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 50 }
    )

    const lastItem = result.data[result.data.length - 1]
    expect(lastItem.employeeId).toBe(emp5.id)
    expect(lastItem.groupId).toBeNull()
    expect(lastItem.groupName).toBeNull()
  })

  it("ページネーション境界でグループが正しく分割されること", async () => {
    const { emp2, emp4, emp3 } = await createGroupedEmployees()

    // pageSize=2: 最初のページにA営業部の2名
    const page1 = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 2, cursor: 0 }
    )

    expect(page1.data).toHaveLength(2)
    expect(page1.hasMore).toBe(true)
    expect(page1.data.map((d) => d.employeeId)).toEqual([emp2.id, emp4.id])

    // 2ページ目: B開発部以降
    const page2 = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 2, cursor: page1.nextCursor! }
    )

    expect(page2.data).toHaveLength(2)
    expect(page2.hasMore).toBe(true)
    expect(page2.data[0].employeeId).toBe(emp3.id) // B開発部 鈴木一郎
  })

  it("groupIdsフィルターで特定グループのみ返ること", async () => {
    const { groupA, emp2, emp4 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month, groupIds: [groupA.id] },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(2)
    expect(result.data.map((d) => d.employeeId)).toEqual([emp2.id, emp4.id])
    expect(result.total).toBe(2)
  })

  it("複数groupIdsフィルターで複数グループの従業員が返ること", async () => {
    const { groupA, groupB, emp2, emp3, emp4 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month, groupIds: [groupA.id, groupB.id] },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(3)
    expect(result.data.map((d) => d.employeeId)).toEqual([emp2.id, emp4.id, emp3.id])
    expect(result.total).toBe(3)
  })

  it("groupIdsとunassignedの同時指定でOR結合されること", async () => {
    const { groupA, emp2, emp4, emp5 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month, groupIds: [groupA.id], unassigned: true },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(3)
    expect(result.data.map((d) => d.employeeId)).toEqual([emp2.id, emp4.id, emp5.id])
    expect(result.total).toBe(3)
  })

  it("unassignedフィルターで未所属のみ返ること", async () => {
    const { emp5 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month, unassigned: true },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(emp5.id)
    expect(result.total).toBe(1)
  })

  it("employeeSearchフィルターで名前検索が動作すること", async () => {
    const { emp2 } = await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month, employeeSearch: "A佐藤" },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(emp2.id)
  })

  it("employeeSearchフィルターでカナ検索が動作すること", async () => {
    // カナ付き従業員を作成
    const group = await prisma.group.create({ data: { name: "テスト部" } })
    const emp = await prisma.employee.create({
      data: { name: "伊藤美咲", nameKana: "イトウミサキ" },
    })
    await prisma.employeeGroup.create({
      data: {
        employeeId: emp.id,
        groupId: group.id,
        startDate: new Date(Date.UTC(2026, 0, 1)),
      },
    })

    const result = await getShiftsForCalendarPaginated(
      { year, month, employeeSearch: "イトウ" },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(emp.id)
  })

  it("退職者（terminationDate < 月初）が除外されること", async () => {
    await prisma.employee.create({
      data: {
        name: "退職済太郎",
        terminationDate: new Date(Date.UTC(2026, 1, 15)), // 2月15日退職
      },
    })
    const activeEmp = await prisma.employee.create({ data: { name: "現役花子" } })

    const result = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(activeEmp.id)
  })

  it("totalが正しく返ること", async () => {
    await createGroupedEmployees()

    const result = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 2 }
    )

    expect(result.total).toBe(5)
    expect(result.data).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toBe(2)
  })

  it("従業員が0人の場合、空配列が返ること", async () => {
    const result = await getShiftsForCalendarPaginated(
      { year, month },
      { pageSize: 50 }
    )

    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
  })
})
