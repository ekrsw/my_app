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
  createDutyAssignment,
  updateDutyAssignment,
  deleteDutyAssignment,
} = await import("@/lib/actions/duty-assignment-actions")

describe("DutyAssignment Actions — シフト整合性バリデーション", () => {
  let employeeId: string
  let dutyTypeId: number

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE duty_assignments, duty_types CASCADE`)
    await cleanupDatabase()
    const employee = await prisma.employee.create({
      data: { name: "田中太郎" },
    })
    employeeId = employee.id

    const dutyType = await prisma.dutyType.create({
      data: { code: "TEL", name: "電話対応" },
    })
    dutyTypeId = dutyType.id
  })

  describe("createDutyAssignment", () => {
    it("シフト内の業務 → 作成成功", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "10:00",
        endTime: "12:00",
      })

      expect(result).toEqual({ success: true })

      const assignments = await prisma.dutyAssignment.findMany()
      expect(assignments).toHaveLength(1)
    })

    it("reducesCapacity を明示的に指定 → 保存される", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "10:00",
        endTime: "12:00",
        reducesCapacity: false,
      })

      expect(result).toEqual({ success: true })

      const assignment = await prisma.dutyAssignment.findFirst()
      expect(assignment?.reducesCapacity).toBe(false)
    })

    it("reducesCapacity 省略時 → デフォルトtrue", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "10:00",
        endTime: "12:00",
      })

      expect(result).toEqual({ success: true })

      const assignment = await prisma.dutyAssignment.findFirst()
      expect(assignment?.reducesCapacity).toBe(true)
    })

    it("シフト未登録日 → エラー", async () => {
      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "10:00",
        endTime: "12:00",
      })

      expect(result.error).toContain("出勤予定がありません")
      const assignments = await prisma.dutyAssignment.findMany()
      expect(assignments).toHaveLength(0)
    })

    it("シフト外の時間帯 → シフト時間を含むエラー", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "18:00",
        endTime: "20:00",
      })

      expect(result.error).toContain("09:00〜17:00")
      const assignments = await prisma.dutyAssignment.findMany()
      expect(assignments).toHaveLength(0)
    })

    it("休日シフト → エラー", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "H",
          isHoliday: true,
        },
      })

      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "10:00",
        endTime: "12:00",
      })

      expect(result.error).toContain("出勤予定がありません")
    })

    it("深夜跨ぎシフト内の業務 → 作成成功", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "N",
          startTime: new Date("1970-01-01T22:00:00Z"),
          endTime: new Date("1970-01-01T08:00:00Z"),
        },
      })

      const result = await createDutyAssignment({
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "23:00",
        endTime: "02:00",
      })

      expect(result).toEqual({ success: true })
    })
  })

  describe("updateDutyAssignment", () => {
    it("シフト外の時間帯に更新 → エラー", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const assignment = await prisma.dutyAssignment.create({
        data: {
          employeeId,
          dutyTypeId,
          dutyDate: new Date("2026-04-10"),
          startTime: new Date("1970-01-01T10:00:00Z"),
          endTime: new Date("1970-01-01T12:00:00Z"),
        },
      })

      const result = await updateDutyAssignment(assignment.id, {
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "18:00",
        endTime: "20:00",
      })

      expect(result.error).toContain("09:00〜17:00")

      // 元のデータが変更されていないことを確認
      const updated = await prisma.dutyAssignment.findUnique({
        where: { id: assignment.id },
      })
      expect(updated).not.toBeNull()
    })

    it("reducesCapacity を更新 → 反映される", async () => {
      await prisma.shift.create({
        data: {
          employeeId,
          shiftDate: new Date("2026-04-10"),
          shiftCode: "A",
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const assignment = await prisma.dutyAssignment.create({
        data: {
          employeeId,
          dutyTypeId,
          dutyDate: new Date("2026-04-10"),
          startTime: new Date("1970-01-01T10:00:00Z"),
          endTime: new Date("1970-01-01T12:00:00Z"),
          reducesCapacity: true,
        },
      })

      const result = await updateDutyAssignment(assignment.id, {
        employeeId,
        dutyTypeId,
        dutyDate: "2026-04-10",
        startTime: "10:00",
        endTime: "12:00",
        reducesCapacity: false,
      })

      expect(result).toEqual({ success: true })

      const updated = await prisma.dutyAssignment.findUnique({
        where: { id: assignment.id },
      })
      expect(updated?.reducesCapacity).toBe(false)
    })
  })
})
