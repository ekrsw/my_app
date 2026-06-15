import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { auth } from "@/auth"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }),
}))

const { recordImportLog, fetchImportLogs } = await import(
  "@/lib/actions/import-log-actions"
)

describe("recordImportLog", () => {
  beforeEach(async () => {
    await cleanupDatabase()
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "admin" } } as never)
  })

  it("正常系: 1件のインポートログが実行者名付きで記録される", async () => {
    const result = await recordImportLog({
      targetType: "shifts",
      fileName: "202601_shift.csv",
      createdCount: 3,
      updatedCount: 2,
      errorCount: 1,
    })

    expect(result).toEqual({ success: true })

    const logs = await prisma.importLog.findMany()
    expect(logs).toHaveLength(1)
    expect(logs[0].targetType).toBe("shifts")
    expect(logs[0].fileName).toBe("202601_shift.csv")
    expect(logs[0].createdCount).toBe(3)
    expect(logs[0].updatedCount).toBe(2)
    expect(logs[0].errorCount).toBe(1)
    expect(logs[0].importedBy).toBe("admin")
  })

  it("未認証では拒否される（ログは作られない）", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as never)

    await expect(
      recordImportLog({
        targetType: "shifts",
        createdCount: 1,
        updatedCount: 0,
        errorCount: 0,
      })
    ).rejects.toThrow()

    const count = await prisma.importLog.count()
    expect(count).toBe(0)
  })

  it("不正な targetType はバリデーションで拒否される", async () => {
    const result = await recordImportLog({
      // @ts-expect-error 不正値のテスト
      targetType: "unknown",
      createdCount: 1,
      updatedCount: 0,
      errorCount: 0,
    })

    expect("error" in result).toBe(true)
    const count = await prisma.importLog.count()
    expect(count).toBe(0)
  })
})

describe("fetchImportLogs", () => {
  beforeEach(async () => {
    await cleanupDatabase()
    vi.mocked(auth).mockResolvedValue({ user: { id: "1", name: "admin" } } as never)
  })

  it("ページネーション付きで取り込み履歴を返す", async () => {
    await recordImportLog({ targetType: "shifts", createdCount: 1, updatedCount: 0, errorCount: 0 })
    await recordImportLog({ targetType: "employees", createdCount: 2, updatedCount: 0, errorCount: 0 })

    const result = await fetchImportLogs({ page: 1, pageSize: 20 })

    expect(result.error).toBeUndefined()
    expect(result.data.total).toBe(2)
    expect(result.data.page).toBe(1)
    expect(result.data.totalPages).toBe(1)
    expect(result.data.data).toHaveLength(2)
  })

  it("targetType フィルタを適用できる", async () => {
    await recordImportLog({ targetType: "shifts", createdCount: 1, updatedCount: 0, errorCount: 0 })
    await recordImportLog({ targetType: "employees", createdCount: 2, updatedCount: 0, errorCount: 0 })

    const result = await fetchImportLogs({ page: 1, pageSize: 20 }, { targetType: "shifts" })

    expect(result.data.total).toBe(1)
    expect(result.data.data.every((l) => l.targetType === "shifts")).toBe(true)
  })

  it("該当が無ければ空の結果を返す", async () => {
    const result = await fetchImportLogs({ page: 1, pageSize: 20 })

    expect(result.data.total).toBe(0)
    expect(result.data.data).toEqual([])
  })
})
