import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

describe("Shift Code Defaults Trigger", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function seedShiftCode(overrides: Partial<{
    code: string
    defaultStartTime: Date | null
    defaultEndTime: Date | null
    defaultIsHoliday: boolean
    defaultIsPaidLeave: boolean
  }> = {}) {
    return prisma.shiftCode.create({
      data: {
        code: overrides.code ?? "A",
        defaultStartTime: overrides.defaultStartTime ?? new Date("1970-01-01T09:00:00Z"),
        defaultEndTime: overrides.defaultEndTime ?? new Date("1970-01-01T18:00:00Z"),
        defaultIsHoliday: overrides.defaultIsHoliday ?? false,
        defaultIsPaidLeave: overrides.defaultIsPaidLeave ?? false,
      },
    })
  }

  async function seedEmployee() {
    return prisma.employee.create({ data: { name: "テスト太郎" } })
  }

  describe("INSERT with shift_code", () => {
    it("should fill start_time and end_time from defaults when NULL", async () => {
      await seedShiftCode()
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: "A",
          startTime: null,
          endTime: null,
          isHoliday: false,
          isPaidLeave: false,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime).not.toBeNull()
      expect(saved!.endTime).not.toBeNull()
      // Verify the time values match defaults (09:00, 18:00)
      expect(saved!.startTime!.toISOString()).toContain("09:00:00")
      expect(saved!.endTime!.toISOString()).toContain("18:00:00")
    })

    it("should not override explicitly provided start_time and end_time", async () => {
      await seedShiftCode()
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T10:00:00Z"),
          endTime: new Date("1970-01-01T19:00:00Z"),
          isHoliday: false,
          isPaidLeave: false,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime!.toISOString()).toContain("10:00:00")
      expect(saved!.endTime!.toISOString()).toContain("19:00:00")
    })

    it("should set is_holiday and is_paid_leave from defaults when NULL", async () => {
      await seedShiftCode({
        code: "H",
        defaultIsHoliday: true,
        defaultIsPaidLeave: false,
        defaultStartTime: null,
        defaultEndTime: null,
      })
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: "H",
          isHoliday: null,
          isPaidLeave: null,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.isHoliday).toBe(true)
      expect(saved!.isPaidLeave).toBe(false)
    })

    it("should not apply defaults when shift_code has no match in shift_codes", async () => {
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: "CUSTOM_CODE",
          startTime: null,
          endTime: null,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime).toBeNull()
      expect(saved!.endTime).toBeNull()
    })

    it("should not apply defaults when shift_code is NULL", async () => {
      await seedShiftCode()
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: null,
          startTime: null,
          endTime: null,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime).toBeNull()
      expect(saved!.endTime).toBeNull()
    })
  })

  describe("UPDATE with shift_code change", () => {
    it("should fill start_time and end_time when changing shift_code and times are NULL", async () => {
      await seedShiftCode()
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: null,
          startTime: null,
          endTime: null,
        },
      })

      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          shiftCode: "A",
          startTime: null,
          endTime: null,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime).not.toBeNull()
      expect(saved!.endTime).not.toBeNull()
      expect(saved!.startTime!.toISOString()).toContain("09:00:00")
    })

    it("should not apply defaults when shift_code does not change", async () => {
      await seedShiftCode()
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: "A",
          startTime: null,
          endTime: null,
        },
      })

      // First save fills in defaults via trigger
      // Now update without changing shift_code, clearing times
      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          startTime: null,
          endTime: null,
          isHoliday: true,
        },
      })

      const saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      // shift_code didn't change, so trigger should NOT reapply defaults
      expect(saved!.startTime).toBeNull()
      expect(saved!.endTime).toBeNull()
    })

    it("should apply defaults when switching between shift codes", async () => {
      await seedShiftCode({ code: "A" })
      await seedShiftCode({
        code: "N",
        defaultStartTime: new Date("1970-01-01T22:00:00Z"),
        defaultEndTime: new Date("1970-01-01T08:00:00Z"),
      })
      const emp = await seedEmployee()

      const shift = await prisma.shift.create({
        data: {
          employeeId: emp.id,
          shiftDate: new Date("2026-03-01"),
          shiftCode: "A",
          startTime: null,
          endTime: null,
        },
      })

      // Shift has A defaults (09:00-18:00)
      let saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime!.toISOString()).toContain("09:00:00")

      // Change to N with NULL times → trigger should apply N defaults
      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          shiftCode: "N",
          startTime: null,
          endTime: null,
        },
      })

      saved = await prisma.shift.findUnique({ where: { id: shift.id } })
      expect(saved!.startTime!.toISOString()).toContain("22:00:00")
      expect(saved!.endTime!.toISOString()).toContain("08:00:00")
    })
  })
})
