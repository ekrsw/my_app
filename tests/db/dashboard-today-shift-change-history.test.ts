import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { getTodayJST } from "@/lib/date-utils"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getTodayShiftChangeHistory } = await import("@/lib/db/dashboard")

describe("getTodayShiftChangeHistory - グループ startDate=null 対応", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("startDate=null のグループ所属が当日の変更履歴に表示される", async () => {
    const today = getTodayJST()
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

    // 開始日 NULL のグループ所属
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: null, endDate: null },
    })

    // 当日のシフト変更履歴レコード（トリガー経由ではなく直接作成）
    await prisma.shiftChangeHistory.create({
      data: { shiftId: 1, employeeId: emp.id, shiftDate: today, version: 1 },
    })

    const result = await getTodayShiftChangeHistory()

    expect(result).toHaveLength(1)
    expect(result[0].employee?.groups).toHaveLength(1)
    expect(result[0].employee?.groups[0].group.name).toBe("開発部")
  })

  it("endDate が過去のグループ所属（startDate=null）は表示されない", async () => {
    const today = getTodayJST()
    const group = await prisma.group.create({ data: { name: "旧部署" } })
    const emp = await prisma.employee.create({ data: { name: "佐藤花子" } })

    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: null, endDate: new Date("2020-01-01") },
    })

    await prisma.shiftChangeHistory.create({
      data: { shiftId: 2, employeeId: emp.id, shiftDate: today, version: 1 },
    })

    const result = await getTodayShiftChangeHistory()

    expect(result).toHaveLength(1)
    // 履歴自体は出るが、終了済みグループは current 所属として出ない
    expect(result[0].employee?.groups).toHaveLength(0)
  })
})
