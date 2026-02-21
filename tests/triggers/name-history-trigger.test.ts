import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

describe("Employee Name History Trigger", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("should create history records on first name change", async () => {
    const employee = await prisma.employee.create({
      data: { name: "田中太郎", nameKana: "タナカタロウ" },
    })

    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "佐藤太郎", nameKana: "サトウタロウ" },
    })

    const history = await prisma.employeeNameHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { id: "asc" },
    })

    expect(history).toHaveLength(2)

    // Old name record (archived)
    expect(history[0].name).toBe("田中太郎")
    expect(history[0].nameKana).toBe("タナカタロウ")
    expect(history[0].isCurrent).toBe(false)
    expect(history[0].validTo).not.toBeNull()

    // New name record (current)
    expect(history[1].name).toBe("佐藤太郎")
    expect(history[1].nameKana).toBe("サトウタロウ")
    expect(history[1].isCurrent).toBe(true)
    expect(history[1].validTo).toBeNull()
  })

  it("should handle second name change correctly", async () => {
    const employee = await prisma.employee.create({
      data: { name: "田中太郎", nameKana: "タナカタロウ" },
    })

    // First change
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "佐藤太郎" },
    })

    // Second change
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "鈴木太郎" },
    })

    const history = await prisma.employeeNameHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { id: "asc" },
    })

    expect(history).toHaveLength(3)

    // All previous records should not be current
    const currentRecords = history.filter((h) => h.isCurrent === true)
    expect(currentRecords).toHaveLength(1)
    expect(currentRecords[0].name).toBe("鈴木太郎")

    // Previous records should have validTo set
    const archivedRecords = history.filter((h) => h.isCurrent === false)
    expect(archivedRecords).toHaveLength(2)
    archivedRecords.forEach((record) => {
      expect(record.validTo).not.toBeNull()
    })
  })

  it("should record history when only nameKana changes", async () => {
    const employee = await prisma.employee.create({
      data: { name: "田中太郎", nameKana: "タナカタロウ" },
    })

    await prisma.employee.update({
      where: { id: employee.id },
      data: { nameKana: "タナカタロー" },
    })

    const history = await prisma.employeeNameHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { id: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].nameKana).toBe("タナカタロウ")
    expect(history[1].nameKana).toBe("タナカタロー")
    expect(history[1].isCurrent).toBe(true)
  })

  it("should NOT create history when name/nameKana are unchanged", async () => {
    const group = await prisma.group.create({ data: { name: "開発部" } })
    const employee = await prisma.employee.create({
      data: { name: "田中太郎", nameKana: "タナカタロウ" },
    })

    // Update only groupId (not name-related)
    await prisma.employee.update({
      where: { id: employee.id },
      data: { groupId: group.id },
    })

    const history = await prisma.employeeNameHistory.findMany({
      where: { employeeId: employee.id },
    })

    expect(history).toHaveLength(0)
  })

  it("should record history when nameKana changes from NULL to a value", async () => {
    const employee = await prisma.employee.create({
      data: { name: "田中太郎", nameKana: null },
    })

    await prisma.employee.update({
      where: { id: employee.id },
      data: { nameKana: "タナカタロウ" },
    })

    const history = await prisma.employeeNameHistory.findMany({
      where: { employeeId: employee.id },
      orderBy: { id: "asc" },
    })

    expect(history).toHaveLength(2)
    expect(history[0].nameKana).toBeNull()
    expect(history[1].nameKana).toBe("タナカタロウ")
    expect(history[1].isCurrent).toBe(true)
  })

  it("should ensure only one is_current=true record per employee at any time", async () => {
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })

    // Multiple name changes
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "佐藤太郎" },
    })
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "鈴木太郎" },
    })
    await prisma.employee.update({
      where: { id: employee.id },
      data: { name: "高橋太郎" },
    })

    const currentRecords = await prisma.employeeNameHistory.findMany({
      where: { employeeId: employee.id, isCurrent: true },
    })

    expect(currentRecords).toHaveLength(1)
    expect(currentRecords[0].name).toBe("高橋太郎")
  })
})
