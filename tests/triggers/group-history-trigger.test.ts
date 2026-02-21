import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

describe("Employee Group History Trigger", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("should record history when group changes", async () => {
    const group1 = await prisma.group.create({ data: { name: "開発部" } })
    const group2 = await prisma.group.create({ data: { name: "営業部" } })

    const employee = await prisma.employee.create({
      data: { name: "田中太郎", groupId: group1.id },
    })

    await prisma.employee.update({
      where: { id: employee.id },
      data: { groupId: group2.id },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(1)
    expect(history[0].groupId).toBe(group1.id) // Old group
    expect(history[0].changeType).toBe("UPDATE")
    expect(history[0].version).toBe(1)
  })

  it("should increment version on second group change", async () => {
    const group1 = await prisma.group.create({ data: { name: "開発部" } })
    const group2 = await prisma.group.create({ data: { name: "営業部" } })
    const group3 = await prisma.group.create({ data: { name: "人事部" } })

    const employee = await prisma.employee.create({
      data: { name: "田中太郎", groupId: group1.id },
    })

    // First change
    await prisma.employee.update({
      where: { id: employee.id },
      data: { groupId: group2.id },
    })

    // Second change
    await prisma.employee.update({
      where: { id: employee.id },
      data: { groupId: group3.id },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { version: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].groupId).toBe(group1.id)
    expect(history[0].version).toBe(1)
    expect(history[1].groupId).toBe(group2.id)
    expect(history[1].version).toBe(2)
  })

  it("should record history when group changes to NULL", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })

    const employee = await prisma.employee.create({
      data: { name: "田中太郎", groupId: group.id },
    })

    await prisma.employee.update({
      where: { id: employee.id },
      data: { groupId: null },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0].groupId).toBe(group.id) // Old group
  })

  it("should record history when group changes from NULL to a group", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })

    const employee = await prisma.employee.create({
      data: { name: "田中太郎", groupId: null },
    })

    await prisma.employee.update({
      where: { id: employee.id },
      data: { groupId: group.id },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
    })

    expect(history).toHaveLength(1)
    expect(history[0].groupId).toBeNull() // Old group was NULL
  })

  it("should NOT create history when group_id is unchanged", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })

    const employee = await prisma.employee.create({
      data: { name: "田中太郎", groupId: group.id },
    })

    // Update name only, not group
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "田中次郎" },
    })

    const history = await prisma.employeeGroupHistory.findMany({
      where: { employeeId: employee.id },
    })

    expect(history).toHaveLength(0)
  })
})
