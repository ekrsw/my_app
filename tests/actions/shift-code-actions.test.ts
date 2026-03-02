import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { createShiftCode, updateShiftCode, deleteShiftCode } = await import(
  "@/lib/actions/shift-code-actions"
)

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe("ShiftCode Actions", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("createShiftCode", () => {
    it("should create a shift code successfully", async () => {
      const result = await createShiftCode(
        makeFormData({
          code: "A",
          defaultStartTime: "09:00",
          defaultEndTime: "18:00",
          defaultIsHoliday: "false",

          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result).toEqual({ success: true })

      const codes = await prisma.shiftCode.findMany()
      expect(codes).toHaveLength(1)
      expect(codes[0].code).toBe("A")
      expect(codes[0].defaultStartTime).not.toBeNull()
      expect(codes[0].defaultEndTime).not.toBeNull()
    })

    it("should create a shift code with null time values", async () => {
      const result = await createShiftCode(
        makeFormData({
          code: "H",
          defaultStartTime: "",
          defaultEndTime: "",
          defaultIsHoliday: "true",

          isActive: "true",
          sortOrder: "4",
        })
      )

      expect(result).toEqual({ success: true })

      const created = await prisma.shiftCode.findUnique({ where: { code: "H" } })
      expect(created!.defaultStartTime).toBeNull()
      expect(created!.defaultEndTime).toBeNull()
      expect(created!.defaultIsHoliday).toBe(true)
    })

    it("should return error for duplicate code (P2002)", async () => {
      await prisma.shiftCode.create({ data: { code: "A" } })

      const result = await createShiftCode(
        makeFormData({
          code: "A",
          defaultIsHoliday: "false",

          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result.error).toBeDefined()
      expect(result.error).toContain("既に使用されています")
    })

    it("should return validation error for empty code", async () => {
      const result = await createShiftCode(
        makeFormData({
          code: "",
          defaultIsHoliday: "false",

          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result.error).toBeDefined()
    })

    it("should create a shift code with color", async () => {
      const result = await createShiftCode(
        makeFormData({
          code: "X",
          color: "blue",
          defaultIsHoliday: "false",
          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result).toEqual({ success: true })

      const created = await prisma.shiftCode.findUnique({ where: { code: "X" } })
      expect(created!.color).toBe("blue")
    })

    it("should create a shift code with null color when not provided", async () => {
      const result = await createShiftCode(
        makeFormData({
          code: "Y",
          defaultIsHoliday: "false",
          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result).toEqual({ success: true })

      const created = await prisma.shiftCode.findUnique({ where: { code: "Y" } })
      expect(created!.color).toBeNull()
    })
  })

  describe("updateShiftCode", () => {
    it("should update a shift code successfully", async () => {
      const sc = await prisma.shiftCode.create({
        data: { code: "A", sortOrder: 0 },
      })

      const result = await updateShiftCode(
        sc.id,
        makeFormData({
          code: "A",
          defaultStartTime: "09:00",
          defaultEndTime: "17:30",
          defaultIsHoliday: "false",

          isActive: "true",
          sortOrder: "1",
        })
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.shiftCode.findUnique({ where: { id: sc.id } })
      expect(updated!.sortOrder).toBe(1)
      expect(updated!.defaultEndTime).not.toBeNull()
    })

    it("should update shift code color", async () => {
      const sc = await prisma.shiftCode.create({
        data: { code: "A", color: "blue", sortOrder: 0 },
      })

      const result = await updateShiftCode(
        sc.id,
        makeFormData({
          code: "A",
          color: "red",
          defaultIsHoliday: "false",
          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.shiftCode.findUnique({ where: { id: sc.id } })
      expect(updated!.color).toBe("red")
    })

    it("should clear shift code color", async () => {
      const sc = await prisma.shiftCode.create({
        data: { code: "A", color: "blue", sortOrder: 0 },
      })

      const result = await updateShiftCode(
        sc.id,
        makeFormData({
          code: "A",
          defaultIsHoliday: "false",
          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.shiftCode.findUnique({ where: { id: sc.id } })
      expect(updated!.color).toBeNull()
    })

    it("should return error for duplicate code on update", async () => {
      await prisma.shiftCode.create({ data: { code: "B" } })
      const sc = await prisma.shiftCode.create({ data: { code: "A" } })

      const result = await updateShiftCode(
        sc.id,
        makeFormData({
          code: "B",
          defaultIsHoliday: "false",

          isActive: "true",
          sortOrder: "0",
        })
      )

      expect(result.error).toBeDefined()
      expect(result.error).toContain("既に使用されています")
    })
  })

  describe("deleteShiftCode", () => {
    it("should delete a shift code successfully", async () => {
      const sc = await prisma.shiftCode.create({
        data: { code: "A" },
      })

      const result = await deleteShiftCode(sc.id)

      expect(result).toEqual({ success: true })

      const found = await prisma.shiftCode.findUnique({ where: { id: sc.id } })
      expect(found).toBeNull()
    })
  })
})
