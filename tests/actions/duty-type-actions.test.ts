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
  createDutyType,
  updateDutyType,
  deleteDutyType,
} = await import("@/lib/actions/duty-type-actions")

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value)
  }
  return fd
}

describe("DutyType Actions", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE duty_assignments, duty_types CASCADE`)
    await cleanupDatabase()
  })

  describe("createDutyType", () => {
    it("デフォルト時刻・備考なしで作成成功", async () => {
      const fd = makeFormData({
        code: "TEL",
        name: "電話対応",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "",
        defaultEndTime: "",
        defaultNote: "",
      })

      const result = await createDutyType(fd)
      expect(result).toEqual({ success: true })

      const dt = await prisma.dutyType.findFirst({ where: { code: "TEL" } })
      expect(dt).not.toBeNull()
      expect(dt!.defaultStartTime).toBeNull()
      expect(dt!.defaultEndTime).toBeNull()
      expect(dt!.defaultNote).toBeNull()
    })

    it("デフォルト時刻・備考ありで作成成功", async () => {
      const fd = makeFormData({
        code: "MTG",
        name: "会議",
        isActive: "true",
        sortOrder: "1",
        defaultReducesCapacity: "true",
        defaultStartTime: "09:00",
        defaultEndTime: "17:00",
        defaultNote: "定例会議",
      })

      const result = await createDutyType(fd)
      expect(result).toEqual({ success: true })

      const dt = await prisma.dutyType.findFirst({ where: { code: "MTG" } })
      expect(dt).not.toBeNull()
      expect(dt!.defaultStartTime).toBe("09:00")
      expect(dt!.defaultEndTime).toBe("17:00")
      expect(dt!.defaultNote).toBe("定例会議")
    })

    it("不正な時刻形式でバリデーションエラー", async () => {
      const fd = makeFormData({
        code: "BAD",
        name: "不正",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "25:00",
        defaultEndTime: "",
        defaultNote: "",
      })

      const result = await createDutyType(fd)
      expect(result).toHaveProperty("error")
    })

    it("重複コードでエラー", async () => {
      await prisma.dutyType.create({
        data: { code: "DUP", name: "既存" },
      })

      const fd = makeFormData({
        code: "DUP",
        name: "重複テスト",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "",
        defaultEndTime: "",
        defaultNote: "",
      })

      const result = await createDutyType(fd)
      expect(result).toEqual({ error: "この業務コードは既に使用されています" })
    })
  })

  describe("updateDutyType", () => {
    it("デフォルト時刻を設定→クリアできる", async () => {
      const dt = await prisma.dutyType.create({
        data: {
          code: "UPD",
          name: "更新テスト",
          defaultStartTime: "09:00",
          defaultEndTime: "17:00",
          defaultNote: "メモ",
        },
      })

      // クリア
      const fd = makeFormData({
        code: "UPD",
        name: "更新テスト",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "",
        defaultEndTime: "",
        defaultNote: "",
      })

      const result = await updateDutyType(dt.id, fd)
      expect(result).toEqual({ success: true })

      const updated = await prisma.dutyType.findUnique({ where: { id: dt.id } })
      expect(updated!.defaultStartTime).toBeNull()
      expect(updated!.defaultEndTime).toBeNull()
      expect(updated!.defaultNote).toBeNull()
    })

    it("デフォルト時刻を変更できる", async () => {
      const dt = await prisma.dutyType.create({
        data: {
          code: "CHG",
          name: "変更テスト",
          defaultStartTime: "09:00",
          defaultEndTime: "17:00",
        },
      })

      const fd = makeFormData({
        code: "CHG",
        name: "変更テスト",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "false",
        defaultStartTime: "10:00",
        defaultEndTime: "18:00",
        defaultNote: "新しいメモ",
      })

      const result = await updateDutyType(dt.id, fd)
      expect(result).toEqual({ success: true })

      const updated = await prisma.dutyType.findUnique({ where: { id: dt.id } })
      expect(updated!.defaultStartTime).toBe("10:00")
      expect(updated!.defaultEndTime).toBe("18:00")
      expect(updated!.defaultNote).toBe("新しいメモ")
    })
  })

  describe("deleteDutyType", () => {
    it("業務種別を削除できる", async () => {
      const dt = await prisma.dutyType.create({
        data: { code: "DEL", name: "削除テスト" },
      })

      const result = await deleteDutyType(dt.id)
      expect(result).toEqual({ success: true })

      const deleted = await prisma.dutyType.findUnique({ where: { id: dt.id } })
      expect(deleted).toBeNull()
    })
  })
})
