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
    expect(history[0].changeType).toBe("UPDATE")
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
    expect(history[0].version).toBe(1)
    expect(history[1].shiftCode).toBe("B")
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
    expect(history[0].shiftCode).toBe("A")
  })
})
