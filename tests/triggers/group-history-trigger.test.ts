import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

describe("Employee Group History Trigger (Junction Table)", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("should record INSERT history when group assignment is created", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })

    await prisma.employeeGroup.create({
      data: {
        employeeId: employee.id,
        groupId: group.id,
        startDate: new Date("2026-01-01"),
      },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(1)
    expect(history[0].groupId).toBe(group.id)
    expect(history[0].changeType).toBe("INSERT")
    expect(history[0].version).toBe(1)
  })

  it("should record UPDATE history when group assignment is modified", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })

    const eg = await prisma.employeeGroup.create({
      data: {
        employeeId: employee.id,
        groupId: group.id,
        startDate: new Date("2026-01-01"),
      },
    })

    // Update end date
    await prisma.employeeGroup.update({
      where: { id: eg.id },
      data: { endDate: new Date("2026-06-30") },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].changeType).toBe("INSERT")
    expect(history[1].changeType).toBe("UPDATE")
    expect(history[1].version).toBe(2)
  })

  it("should record DELETE history when group assignment is removed", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })

    const eg = await prisma.employeeGroup.create({
      data: {
        employeeId: employee.id,
        groupId: group.id,
        startDate: new Date("2026-01-01"),
      },
    })

    await prisma.employeeGroup.delete({ where: { id: eg.id } })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].changeType).toBe("INSERT")
    expect(history[1].changeType).toBe("DELETE")
  })

  it("should support multiple group assignments", async () => {
    const group1 = await prisma.group.create({ data: { name: "開発部" } })
    const group2 = await prisma.group.create({ data: { name: "営業部" } })
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })

    await prisma.employeeGroup.create({
      data: {
        employeeId: employee.id,
        groupId: group1.id,
        startDate: new Date("2026-01-01"),
      },
    })

    await prisma.employeeGroup.create({
      data: {
        employeeId: employee.id,
        groupId: group2.id,
        startDate: new Date("2026-01-01"),
      },
    })

    const groups = await prisma.employeeGroup.findMany({
      where: { employeeId: employee.id },
    })
    expect(groups).toHaveLength(2)

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { version: "asc" },
    })
    expect(history).toHaveLength(2)
    expect(history.every((h) => h.changeType === "INSERT")).toBe(true)
  })
})
