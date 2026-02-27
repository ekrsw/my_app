import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { vi } from "vitest"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getShiftHistory, getShiftVersions } = await import("@/lib/db/history")

async function createShiftWithHistory() {
  const employee = await prisma.employee.create({
    data: { name: "田中太郎" },
  })

  const shift = await prisma.shift.create({
    data: {
      employeeId: employee.id,
      shiftDate: new Date("2026-01-15"),
      shiftCode: "A",
    },
  })

  // Create history records manually
  await prisma.shiftChangeHistory.createMany({
    data: [
      {
        shiftId: shift.id,
        employeeId: employee.id,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "B",
        newShiftCode: "A",
        version: 1,
      },
      {
        shiftId: shift.id,
        employeeId: employee.id,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
        newShiftCode: "B",
        version: 2,
      },
    ],
  })

  return { employee, shift }
}

describe("History DB Queries", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getShiftHistory", () => {
    it("should return paginated shift history", async () => {
      const { shift } = await createShiftWithHistory()

      const result = await getShiftHistory({ page: 1, pageSize: 10 })

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.data[0].shiftId).toBe(shift.id)
    })

    it("should include employee relation", async () => {
      const { employee } = await createShiftWithHistory()

      const result = await getShiftHistory({ page: 1, pageSize: 10 })

      expect(result.data[0].employee).not.toBeNull()
      expect(result.data[0].employee?.name).toBe(employee.name)
    })

    it("should filter by shiftId", async () => {
      const { shift } = await createShiftWithHistory()

      // Create another shift with history
      const employee2 = await prisma.employee.create({
        data: { name: "佐藤花子" },
      })
      const shift2 = await prisma.shift.create({
        data: {
          employeeId: employee2.id,
          shiftDate: new Date("2026-01-16"),
          shiftCode: "C",
        },
      })
      await prisma.shiftChangeHistory.create({
        data: {
          shiftId: shift2.id,
          employeeId: employee2.id,
          shiftDate: new Date("2026-01-16"),
          shiftCode: "D",
          version: 1,
        },
      })

      const result = await getShiftHistory(
        { page: 1, pageSize: 10 },
        shift.id
      )

      expect(result.data).toHaveLength(2)
      expect(result.data.every((h) => h.shiftId === shift.id)).toBe(true)
    })

    it("should filter by employeeId", async () => {
      const { employee } = await createShiftWithHistory()

      const result = await getShiftHistory(
        { page: 1, pageSize: 10 },
        undefined,
        employee.id
      )

      expect(result.data).toHaveLength(2)
      expect(result.data.every((h) => h.employeeId === employee.id)).toBe(true)
    })
  })

  describe("getShiftVersions", () => {
    it("should return all versions for a shift", async () => {
      const { shift } = await createShiftWithHistory()

      const result = await getShiftVersions(shift.id)

      expect(result).toHaveLength(2)
      // Should be ordered by version desc
      expect(result[0].version).toBe(2)
      expect(result[1].version).toBe(1)
    })
  })
})
