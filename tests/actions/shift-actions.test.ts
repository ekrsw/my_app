import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const {
  createShift,
  updateShift,
  deleteShift,
  bulkUpdateShifts,
  restoreShiftVersion,
} = await import("@/lib/actions/shift-actions")

describe("Shift Actions", () => {
  let employeeId: number

  beforeEach(async () => {
    await cleanupDatabase()
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })
    employeeId = employee.id
  })

  describe("createShift", () => {
    it("should create a shift successfully", async () => {
      const result = await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
        startTime: "09:00",
        endTime: "18:00",
      })

      expect(result).toEqual({ success: true })

      const shifts = await prisma.shift.findMany()
      expect(shifts).toHaveLength(1)
      expect(shifts[0].shiftCode).toBe("A")
    })

    it("should return error for duplicate employee+date (P2002)", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })

      const result = await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "B",
      })

      expect(result.error).toBeDefined()
      expect(result.error).toContain("既に存在します")
    })
  })

  describe("updateShift", () => {
    it("should update a shift successfully", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })

      const shift = await prisma.shift.findFirst()

      const result = await updateShift(shift!.id, {
        shiftCode: "B",
        isHoliday: true,
      })

      expect(result).toEqual({ success: true })

      const updated = await prisma.shift.findUnique({
        where: { id: shift!.id },
      })
      expect(updated!.shiftCode).toBe("B")
      expect(updated!.isHoliday).toBe(true)
    })

    it("should create history record via trigger on update", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })

      const shift = await prisma.shift.findFirst()

      await updateShift(shift!.id, {
        shiftCode: "B",
        isHoliday: true,
      })

      const history = await prisma.shiftChangeHistory.findMany({
        where: { shiftId: shift!.id },
        orderBy: { version: "asc" },
      })

      expect(history).toHaveLength(1)
      expect(history[0].shiftCode).toBe("A")
      expect(history[0].changeType).toBe("UPDATE")
      expect(history[0].version).toBe(1)
    })
  })

  describe("deleteShift", () => {
    it("should delete a shift successfully", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })

      const shift = await prisma.shift.findFirst()

      const result = await deleteShift(shift!.id)

      expect(result).toEqual({ success: true })
    })
  })

  describe("bulkUpdateShifts", () => {
    it("should bulk update multiple shifts", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })
      await createShift({
        employeeId,
        shiftDate: "2026-01-16",
        shiftCode: "A",
      })

      const shifts = await prisma.shift.findMany()
      const ids = shifts.map((s) => s.id)

      const result = await bulkUpdateShifts({
        shiftIds: ids,
        shiftCode: "B",
        isRemote: true,
      })

      expect(result.success).toBe(true)

      const updated = await prisma.shift.findMany()
      expect(updated.every((s) => s.shiftCode === "B")).toBe(true)
      expect(updated.every((s) => s.isRemote === true)).toBe(true)
    })

    it("should create history records via trigger for each updated shift", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })
      await createShift({
        employeeId,
        shiftDate: "2026-01-16",
        shiftCode: "A",
      })

      const shifts = await prisma.shift.findMany()
      const ids = shifts.map((s) => s.id)

      await bulkUpdateShifts({
        shiftIds: ids,
        shiftCode: "B",
      })

      const history = await prisma.shiftChangeHistory.findMany({
        orderBy: { shiftId: "asc" },
      })

      expect(history).toHaveLength(2)
      expect(history.every((h) => h.shiftCode === "A")).toBe(true)
      expect(history.every((h) => h.changeType === "UPDATE")).toBe(true)
    })
  })

  describe("restoreShiftVersion", () => {
    it("should restore a shift from history", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })

      const shift = await prisma.shift.findFirst()

      // Create a history version
      await prisma.shiftChangeHistory.create({
        data: {
          shiftId: shift!.id,
          employeeId,
          shiftDate: new Date("2026-01-15"),
          shiftCode: "B",
          isHoliday: true,
          changeType: "UPDATE",
          version: 1,
        },
      })

      // Update shift to different value
      await updateShift(shift!.id, { shiftCode: "C" })

      // Restore to version 1
      const result = await restoreShiftVersion(shift!.id, 1)

      expect(result).toEqual({ success: true })

      const restored = await prisma.shift.findUnique({
        where: { id: shift!.id },
      })
      expect(restored!.shiftCode).toBe("B")
      expect(restored!.isHoliday).toBe(true)
    })

    it("should return error for non-existent version", async () => {
      await createShift({
        employeeId,
        shiftDate: "2026-01-15",
        shiftCode: "A",
      })

      const shift = await prisma.shift.findFirst()

      const result = await restoreShiftVersion(shift!.id, 999)

      expect(result.error).toBeDefined()
    })
  })
})
