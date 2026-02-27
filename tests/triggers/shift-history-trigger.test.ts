import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

describe("Shift Change History Trigger", () => {
  let employeeId: number

  beforeEach(async () => {
    await cleanupDatabase()
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })
    employeeId = employee.id
  })

  it("should record history when shiftCode changes", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
      },
    })

    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "B" },
    })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(1)
    expect(history[0].shiftCode).toBe("A") // OLD value
    expect(history[0].newShiftCode).toBe("B") // NEW value
    expect(history[0].version).toBe(1)
    expect(history[0].employeeId).toBe(employeeId)
  })

  it("should increment version on second change", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
      },
    })

    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "B" },
    })

    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "C" },
    })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].shiftCode).toBe("A")
    expect(history[0].newShiftCode).toBe("B")
    expect(history[0].version).toBe(1)
    expect(history[1].shiftCode).toBe("B")
    expect(history[1].newShiftCode).toBe("C")
    expect(history[1].version).toBe(2)
  })

  it("should record single history for multiple field changes", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
        isHoliday: false,
        isRemote: false,
      },
    })

    await prisma.shift.update({
      where: { id: shift.id },
      data: {
        shiftCode: "B",
        isHoliday: true,
        isRemote: true,
      },
    })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0].shiftCode).toBe("A")
    expect(history[0].isHoliday).toBe(false)
    expect(history[0].isRemote).toBe(false)
    expect(history[0].newShiftCode).toBe("B")
    expect(history[0].newIsHoliday).toBe(true)
    expect(history[0].newIsRemote).toBe(true)
  })

  it("should NOT create history when no tracked fields change", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
      },
    })

    // Update with the same values (no actual change)
    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "A" },
    })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
    })

    expect(history).toHaveLength(0)
  })

  it("should detect isRemote boolean change", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
        isRemote: false,
      },
    })

    await prisma.shift.update({
      where: { id: shift.id },
      data: { isRemote: true },
    })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0].isRemote).toBe(false) // OLD value
    expect(history[0].newIsRemote).toBe(true) // NEW value
    expect(history[0].shiftCode).toBe("A")
  })

  it("should record history on DELETE with OLD values and NULL NEW values", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
        isHoliday: false,
        isPaidLeave: true,
        isRemote: false,
      },
    })

    await prisma.shift.delete({ where: { id: shift.id } })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0].shiftCode).toBe("A")
    expect(history[0].isHoliday).toBe(false)
    expect(history[0].isPaidLeave).toBe(true)
    expect(history[0].isRemote).toBe(false)
    expect(history[0].employeeId).toBe(employeeId)
    // NEW values should all be NULL for DELETE
    expect(history[0].newShiftCode).toBeNull()
    expect(history[0].newStartTime).toBeNull()
    expect(history[0].newEndTime).toBeNull()
    expect(history[0].newIsHoliday).toBeNull()
    expect(history[0].newIsPaidLeave).toBeNull()
    expect(history[0].newIsRemote).toBeNull()
  })

  it("should retain history records after shift deletion (no FK constraint)", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
      },
    })

    // Create a history record via update
    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "B" },
    })

    // Delete the shift (should succeed and create DELETE history)
    await prisma.shift.delete({ where: { id: shift.id } })

    // Verify the shift is deleted
    const deletedShift = await prisma.shift.findUnique({ where: { id: shift.id } })
    expect(deletedShift).toBeNull()

    // Verify all history records still exist
    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].newShiftCode).not.toBeNull()
    expect(history[1].newShiftCode).toBeNull()
  })

  it("should correctly increment version for DELETE after UPDATE", async () => {
    const shift = await prisma.shift.create({
      data: {
        employeeId,
        shiftDate: new Date("2026-01-15"),
        shiftCode: "A",
      },
    })

    // Two updates
    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "B" },
    })
    await prisma.shift.update({
      where: { id: shift.id },
      data: { shiftCode: "C" },
    })

    // Then delete
    await prisma.shift.delete({ where: { id: shift.id } })

    const history = await prisma.shiftChangeHistory.findMany({
      where: { shiftId: shift.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(3)
    expect(history[0].version).toBe(1)
    expect(history[0].newShiftCode).not.toBeNull()
    expect(history[1].version).toBe(2)
    expect(history[1].newShiftCode).not.toBeNull()
    expect(history[2].version).toBe(3)
    expect(history[2].newShiftCode).toBeNull()
    expect(history[2].shiftCode).toBe("C") // Last value before deletion
  })
})
