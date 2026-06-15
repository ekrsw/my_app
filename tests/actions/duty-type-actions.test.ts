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
  importDutyTypes,
} = await import("@/lib/actions/duty-type-actions")

function makeImportRow(
  overrides: Partial<{
    rowIndex: number
    name: string
    color: string | null
    isActive: boolean
    sortOrder: number
    defaultReducesCapacity: boolean
    defaultStartTime: string | null
    defaultEndTime: string | null
    defaultTitle: string | null
    defaultNote: string | null
  }> = {}
) {
  return {
    rowIndex: 1,
    name: "電話対応",
    color: null,
    isActive: true,
    sortOrder: 0,
    defaultReducesCapacity: true,
    defaultStartTime: null,
    defaultEndTime: null,
    defaultTitle: null,
    defaultNote: null,
    ...overrides,
  }
}

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

      const dt = await prisma.dutyType.findFirst({ where: { name: "電話対応" } })
      expect(dt).not.toBeNull()
      expect(dt!.defaultStartTime).toBeNull()
      expect(dt!.defaultEndTime).toBeNull()
      expect(dt!.defaultNote).toBeNull()
    })

    it("デフォルト時刻・備考ありで作成成功", async () => {
      const fd = makeFormData({
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

      const dt = await prisma.dutyType.findFirst({ where: { name: "会議" } })
      expect(dt).not.toBeNull()
      expect(dt!.defaultStartTime).toBe("09:00")
      expect(dt!.defaultEndTime).toBe("17:00")
      expect(dt!.defaultNote).toBe("定例会議")
    })

    it("不正な時刻形式でバリデーションエラー", async () => {
      const fd = makeFormData({
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
  })

  describe("updateDutyType", () => {
    it("デフォルト時刻を設定→クリアできる", async () => {
      const dt = await prisma.dutyType.create({
        data: {
          name: "更新テスト",
          defaultStartTime: "09:00",
          defaultEndTime: "17:00",
          defaultNote: "メモ",
        },
      })

      // クリア
      const fd = makeFormData({
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
          name: "変更テスト",
          defaultStartTime: "09:00",
          defaultEndTime: "17:00",
        },
      })

      const fd = makeFormData({
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

  describe("defaultTitle", () => {
    it("defaultTitle 付きで作成 → DB に保存される", async () => {
      const fd = makeFormData({
        name: "タイトルテスト",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "",
        defaultEndTime: "",
        defaultNote: "",
        defaultTitle: "A社訪問",
      })

      const result = await createDutyType(fd)
      expect(result).toEqual({ success: true })

      const dt = await prisma.dutyType.findFirst({ where: { name: "タイトルテスト" } })
      expect(dt?.defaultTitle).toBe("A社訪問")
    })

    it("defaultTitle 空文字 → null で保存される", async () => {
      const fd = makeFormData({
        name: "タイトルなし",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "",
        defaultEndTime: "",
        defaultNote: "",
        defaultTitle: "",
      })

      const result = await createDutyType(fd)
      expect(result).toEqual({ success: true })

      const dt = await prisma.dutyType.findFirst({ where: { name: "タイトルなし" } })
      expect(dt?.defaultTitle).toBeNull()
    })

    it("defaultTitle を更新 → 反映される", async () => {
      const dt = await prisma.dutyType.create({
        data: { name: "タイトル更新", defaultTitle: "旧タイトル" },
      })

      const fd = makeFormData({
        name: "タイトル更新",
        isActive: "true",
        sortOrder: "0",
        defaultReducesCapacity: "true",
        defaultStartTime: "",
        defaultEndTime: "",
        defaultNote: "",
        defaultTitle: "新タイトル",
      })

      const result = await updateDutyType(dt.id, fd)
      expect(result).toEqual({ success: true })

      const updated = await prisma.dutyType.findUnique({ where: { id: dt.id } })
      expect(updated?.defaultTitle).toBe("新タイトル")
    })
  })

  describe("deleteDutyType", () => {
    it("業務種別を削除できる", async () => {
      const dt = await prisma.dutyType.create({
        data: { name: "削除テスト" },
      })

      const result = await deleteDutyType(dt.id)
      expect(result).toEqual({ success: true })

      const deleted = await prisma.dutyType.findUnique({ where: { id: dt.id } })
      expect(deleted).toBeNull()
    })

    it("使用中（割当あり）の業務種別削除はエラーを返す", async () => {
      const dt = await prisma.dutyType.create({ data: { name: "使用中種別" } })
      const emp = await prisma.employee.create({ data: { name: "田中太郎" } })
      await prisma.dutyAssignment.create({
        data: {
          dutyTypeId: dt.id,
          employeeId: emp.id,
          dutyDate: new Date("2026-01-15"),
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
        },
      })

      const result = await deleteDutyType(dt.id)

      expect(result).toHaveProperty("error")
      // 削除は失敗し、レコードは残っている
      const still = await prisma.dutyType.findUnique({ where: { id: dt.id } })
      expect(still).not.toBeNull()
    })
  })

  describe("importDutyTypes", () => {
    it("新規行を作成し created にカウントする", async () => {
      const result = await importDutyTypes([
        makeImportRow({ rowIndex: 1, name: "電話対応" }),
        makeImportRow({ rowIndex: 2, name: "会議", defaultStartTime: "09:00", defaultEndTime: "17:00" }),
      ])

      expect(result.created).toBe(2)
      expect(result.updated).toBe(0)
      expect(result.errors).toEqual([])

      const meeting = await prisma.dutyType.findFirst({ where: { name: "会議" } })
      expect(meeting!.defaultStartTime).toBe("09:00")
      expect(meeting!.defaultEndTime).toBe("17:00")
    })

    it("同名の既存行は更新し updated にカウントする", async () => {
      await prisma.dutyType.create({
        data: { name: "電話対応", sortOrder: 0, defaultNote: "旧メモ" },
      })

      const result = await importDutyTypes([
        makeImportRow({ name: "電話対応", sortOrder: 5, defaultNote: "新メモ" }),
      ])

      expect(result.created).toBe(0)
      expect(result.updated).toBe(1)

      const dt = await prisma.dutyType.findFirst({ where: { name: "電話対応" } })
      expect(dt!.sortOrder).toBe(5)
      expect(dt!.defaultNote).toBe("新メモ")
    })

    it("新規と更新が混在しても正しく集計する", async () => {
      await prisma.dutyType.create({ data: { name: "既存種別" } })

      const result = await importDutyTypes([
        makeImportRow({ rowIndex: 1, name: "既存種別" }),
        makeImportRow({ rowIndex: 2, name: "新規種別" }),
      ])

      expect(result.created).toBe(1)
      expect(result.updated).toBe(1)
      expect(result.errors).toEqual([])
    })

    it("保存失敗した行は errors に rowIndex 付きで記録し他の行は処理を続行する", async () => {
      // name は VarChar(50)。51 文字超で DB エラーを誘発する
      const tooLong = "あ".repeat(60)

      const result = await importDutyTypes([
        makeImportRow({ rowIndex: 1, name: "正常種別" }),
        makeImportRow({ rowIndex: 2, name: tooLong }),
      ])

      expect(result.created).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].rowIndex).toBe(2)

      // 正常な行はコミットされている
      const ok = await prisma.dutyType.findFirst({ where: { name: "正常種別" } })
      expect(ok).not.toBeNull()
    })

    it("空配列なら全カウント 0", async () => {
      const result = await importDutyTypes([])
      expect(result).toEqual({ created: 0, updated: 0, errors: [] })
    })
  })
})
