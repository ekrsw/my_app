import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { vi } from "vitest"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getShiftCodes, getActiveShiftCodes } = await import("@/lib/db/shift-codes")

describe("ShiftCode DB Queries", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getShiftCodes", () => {
    it("should return all shift codes ordered by sortOrder", async () => {
      await prisma.shiftCode.createMany({
        data: [
          { code: "B", sortOrder: 1 },
          { code: "A", sortOrder: 0 },
          { code: "N", sortOrder: 2, isActive: false },
        ],
      })

      const result = await getShiftCodes()

      expect(result).toHaveLength(3)
      expect(result[0].code).toBe("A")
      expect(result[1].code).toBe("B")
      expect(result[2].code).toBe("N")
    })

    it("should return empty array when no shift codes exist", async () => {
      const result = await getShiftCodes()
      expect(result).toHaveLength(0)
    })
  })

  describe("getActiveShiftCodes", () => {
    it("should return only active shift codes", async () => {
      await prisma.shiftCode.createMany({
        data: [
          { code: "A", sortOrder: 0, isActive: true },
          { code: "B", sortOrder: 1, isActive: true },
          { code: "N", sortOrder: 2, isActive: false },
        ],
      })

      const result = await getActiveShiftCodes()

      expect(result).toHaveLength(2)
      expect(result.every((sc) => sc.isActive === true)).toBe(true)
    })

    it("should return shift codes with color field", async () => {
      await prisma.shiftCode.createMany({
        data: [
          { code: "A", sortOrder: 0, color: "blue" },
          { code: "B", sortOrder: 1, color: null },
        ],
      })

      const result = await getActiveShiftCodes()

      expect(result).toHaveLength(2)
      expect(result[0].color).toBe("blue")
      expect(result[1].color).toBeNull()
    })

    it("should return shift codes with default time values", async () => {
      await prisma.shiftCode.create({
        data: {
          code: "A",
          defaultStartTime: new Date("1970-01-01T09:00:00Z"),
          defaultEndTime: new Date("1970-01-01T18:00:00Z"),
          defaultIsHoliday: false,
          sortOrder: 0,
        },
      })

      const result = await getActiveShiftCodes()

      expect(result).toHaveLength(1)
      expect(result[0].defaultStartTime).not.toBeNull()
      expect(result[0].defaultEndTime).not.toBeNull()
    })
  })
})
