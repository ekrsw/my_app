import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const {
  getShiftIdsWithHistory,
  getLatestShiftHistoryEntries,
  getShiftById,
  getDailyFilterOptions,
} = await import("@/lib/db/shifts")

async function createEmployee(name: string) {
  return prisma.employee.create({ data: { name } })
}

/** シフトを作成し update でトリガー履歴を発生させる */
async function createShiftWithHistory(
  employeeId: string,
  shiftDate: string,
  fromCode: string,
  toCode: string
) {
  const shift = await prisma.shift.create({
    data: { employeeId, shiftDate: new Date(shiftDate), shiftCode: fromCode },
  })
  await prisma.shift.update({
    where: { id: shift.id },
    data: { shiftCode: toCode },
  })
  return shift
}

describe("lib/db/shifts — history & byId queries", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getShiftIdsWithHistory", () => {
    it("指定月に履歴を持つ shiftId の Set を返す", async () => {
      const emp = await createEmployee("田中太郎")
      const shift = await createShiftWithHistory(emp.id, "2026-01-15", "A", "B")

      const result = await getShiftIdsWithHistory(2026, 1)

      expect(result).toBeInstanceOf(Set)
      expect(result.has(shift.id)).toBe(true)
      expect(result.size).toBe(1)
    })

    it("別の月の履歴は含めない", async () => {
      const emp = await createEmployee("田中太郎")
      await createShiftWithHistory(emp.id, "2026-01-15", "A", "B")

      const result = await getShiftIdsWithHistory(2026, 2)

      expect(result.size).toBe(0)
    })

    it("同一 shift の複数回変更でも shiftId は重複しない（distinct）", async () => {
      const emp = await createEmployee("田中太郎")
      const shift = await prisma.shift.create({
        data: { employeeId: emp.id, shiftDate: new Date("2026-01-15"), shiftCode: "A" },
      })
      await prisma.shift.update({ where: { id: shift.id }, data: { shiftCode: "B" } })
      await prisma.shift.update({ where: { id: shift.id }, data: { shiftCode: "C" } })

      const result = await getShiftIdsWithHistory(2026, 1)

      expect(result.size).toBe(1)
    })

    it("履歴が無ければ空の Set", async () => {
      const result = await getShiftIdsWithHistory(2026, 1)
      expect(result.size).toBe(0)
    })
  })

  describe("getLatestShiftHistoryEntries", () => {
    it("shiftId ごとに最新 version のエントリを返す", async () => {
      const emp = await createEmployee("田中太郎")
      const shift = await prisma.shift.create({
        data: { employeeId: emp.id, shiftDate: new Date("2026-01-15"), shiftCode: "A" },
      })
      await prisma.shift.update({ where: { id: shift.id }, data: { shiftCode: "B" } }) // v1: A->B
      await prisma.shift.update({ where: { id: shift.id }, data: { shiftCode: "C" } }) // v2: B->C

      const result = await getLatestShiftHistoryEntries(2026, 1)

      // 最新（version DESC の先頭）= B->C
      expect(result[shift.id]).toBeDefined()
      expect(result[shift.id].shiftCode).toBe("B")
      expect(result[shift.id].newShiftCode).toBe("C")
    })

    it("指定月の履歴のみを対象にする", async () => {
      const emp = await createEmployee("田中太郎")
      const shift = await createShiftWithHistory(emp.id, "2026-01-15", "A", "B")

      const otherMonth = await getLatestShiftHistoryEntries(2026, 3)
      expect(otherMonth[shift.id]).toBeUndefined()

      const sameMonth = await getLatestShiftHistoryEntries(2026, 1)
      expect(sameMonth[shift.id]).toBeDefined()
    })

    it("履歴が無ければ空オブジェクト", async () => {
      expect(await getLatestShiftHistoryEntries(2026, 1)).toEqual({})
    })
  })

  describe("getShiftById", () => {
    it("従業員と現役グループ所属付きでシフトを返す", async () => {
      const emp = await createEmployee("田中太郎")
      const group = await prisma.group.create({ data: { name: "開発部" } })
      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group.id, endDate: null },
      })
      const shift = await prisma.shift.create({
        data: { employeeId: emp.id, shiftDate: new Date("2026-01-15"), shiftCode: "A" },
      })

      const result = await getShiftById(shift.id)

      expect(result).not.toBeNull()
      expect(result!.shiftCode).toBe("A")
      expect(result!.employee!.name).toBe("田中太郎")
      expect(result!.employee!.groups).toHaveLength(1)
      expect(result!.employee!.groups[0].group.name).toBe("開発部")
    })

    it("終了済みグループ所属は含めない", async () => {
      const emp = await createEmployee("田中太郎")
      const group = await prisma.group.create({ data: { name: "旧部署" } })
      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group.id, endDate: new Date("2020-01-01") },
      })
      const shift = await prisma.shift.create({
        data: { employeeId: emp.id, shiftDate: new Date("2026-01-15"), shiftCode: "A" },
      })

      const result = await getShiftById(shift.id)

      expect(result!.employee!.groups).toHaveLength(0)
    })

    it("存在しない id は null", async () => {
      expect(await getShiftById(999999)).toBeNull()
    })
  })

  describe("getDailyFilterOptions", () => {
    it("指定日のシフト・所属からカスケード用オプションを抽出する", async () => {
      const emp = await createEmployee("田中太郎")
      const group = await prisma.group.create({ data: { name: "開発部" } })
      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group.id, endDate: null },
      })
      await prisma.shift.create({
        data: { employeeId: emp.id, shiftDate: new Date("2026-01-15"), shiftCode: "A" },
      })

      const result = await getDailyFilterOptions({ date: "2026-01-15" })

      expect(result.employees.map((e) => e.name)).toContain("田中太郎")
      expect(result.groups.map((g) => g.name)).toContain("開発部")
      expect(result.shiftCodes).toContain("A")
      expect(typeof result.hasUnassigned).toBe("boolean")
    })

    it("未所属の従業員がいれば hasUnassigned=true", async () => {
      const emp = await createEmployee("無所属太郎")
      await prisma.shift.create({
        data: { employeeId: emp.id, shiftDate: new Date("2026-01-15"), shiftCode: "A" },
      })

      const result = await getDailyFilterOptions({ date: "2026-01-15" })

      expect(result.hasUnassigned).toBe(true)
    })

    it("該当日にデータが無ければ空のオプションを返す", async () => {
      const result = await getDailyFilterOptions({ date: "2026-01-15" })

      expect(result.employees).toEqual([])
      expect(result.shiftCodes).toEqual([])
      expect(result.supervisorRoleNames).toEqual([])
      expect(result.businessRoleNames).toEqual([])
    })
  })
})
