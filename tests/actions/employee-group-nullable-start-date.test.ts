import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }),
}))

const {
  createEmployee,
  addEmployeeGroup,
  updateEmployeeGroup,
  updateEmployeeWithRoles,
} = await import("@/lib/actions/employee-actions")

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe("Employee Group Actions - nullable startDate", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("createEmployee", () => {
    it("グループ付きで従業員作成時、startDate 未指定なら null になる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const result = await createEmployee(
        makeFormData({ name: "田中太郎", groupId: String(group.id) })
      )

      expect(result).toEqual({ success: true })

      const employee = await prisma.employee.findFirst({
        include: { groups: true },
      })
      expect(employee!.groups).toHaveLength(1)
      expect(employee!.groups[0].startDate).toBeNull()
    })

    it("グループ付きで従業員作成時、hireDate 指定ありなら startDate に反映される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })

      const result = await createEmployee(
        makeFormData({
          name: "田中太郎",
          groupId: String(group.id),
          hireDate: "2025-04-01",
        })
      )

      expect(result).toEqual({ success: true })

      const employee = await prisma.employee.findFirst({
        include: { groups: true },
      })
      expect(employee!.groups).toHaveLength(1)
      expect(employee!.groups[0].startDate).not.toBeNull()
    })
  })

  describe("addEmployeeGroup", () => {
    it("startDate 未指定で追加すると null で保存される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await addEmployeeGroup({
        employeeId: emp.id,
        groupId: group.id,
      })

      expect(result).toEqual({ success: true })

      const eg = await prisma.employeeGroup.findFirst({
        where: { employeeId: emp.id },
      })
      expect(eg).not.toBeNull()
      expect(eg!.startDate).toBeNull()
    })

    it("startDate=null を明示的に渡して追加すると null で保存される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await addEmployeeGroup({
        employeeId: emp.id,
        groupId: group.id,
        startDate: null,
      })

      expect(result).toEqual({ success: true })

      const eg = await prisma.employeeGroup.findFirst({
        where: { employeeId: emp.id },
      })
      expect(eg!.startDate).toBeNull()
    })

    it("startDate を指定して追加すると日付が保存される", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await addEmployeeGroup({
        employeeId: emp.id,
        groupId: group.id,
        startDate: "2025-04-01",
      })

      expect(result).toEqual({ success: true })

      const eg = await prisma.employeeGroup.findFirst({
        where: { employeeId: emp.id },
      })
      expect(eg!.startDate).not.toBeNull()
    })
  })

  describe("updateEmployeeGroup", () => {
    it("startDate を null に更新できる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const eg = await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: new Date("2025-04-01"),
        },
      })

      const result = await updateEmployeeGroup(eg.id, { startDate: null })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeeGroup.findUnique({
        where: { id: eg.id },
      })
      expect(updated!.startDate).toBeNull()
    })

    it("startDate を日付から別の日付に更新できる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const eg = await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: new Date("2025-04-01"),
        },
      })

      const result = await updateEmployeeGroup(eg.id, {
        startDate: "2025-06-01",
      })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeeGroup.findUnique({
        where: { id: eg.id },
      })
      expect(updated!.startDate).not.toBeNull()
    })

    it("startDate=null のレコードに日付を設定できる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const eg = await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: null,
        },
      })

      const result = await updateEmployeeGroup(eg.id, {
        startDate: "2025-04-01",
      })

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeeGroup.findUnique({
        where: { id: eg.id },
      })
      expect(updated!.startDate).not.toBeNull()
    })
  })

  describe("updateEmployeeWithRoles (group changes)", () => {
    it("グループ新規追加で startDate 未指定なら null になる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })

      const result = await updateEmployeeWithRoles(
        emp.id,
        { name: "田中太郎", nameKana: null, hireDate: null, terminationDate: null },
        [],
        [],
        [{ status: "added" as const, groupId: group.id }]
      )

      expect(result).toEqual({ success: true })

      const egs = await prisma.employeeGroup.findMany({
        where: { employeeId: emp.id },
      })
      expect(egs).toHaveLength(1)
      expect(egs[0].startDate).toBeNull()
    })

    it("グループ更新で startDate を null に変更できる", async () => {
      const group = await prisma.group.create({ data: { name: "開発部" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      const eg = await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group.id,
          startDate: new Date("2025-04-01"),
        },
      })

      const result = await updateEmployeeWithRoles(
        emp.id,
        { name: "田中太郎", nameKana: null, hireDate: null, terminationDate: null },
        [],
        [],
        [{ status: "modified" as const, id: eg.id, startDate: null }]
      )

      expect(result).toEqual({ success: true })

      const updated = await prisma.employeeGroup.findUnique({
        where: { id: eg.id },
      })
      expect(updated!.startDate).toBeNull()
    })
  })
})
