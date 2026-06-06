import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getImportLogs } = await import("@/lib/db/import-logs")

describe("getImportLogs", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("空状態では空配列と total 0 を返す", async () => {
    const result = await getImportLogs({ page: 1, pageSize: 20 })
    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
  })

  it("targetType でフィルタできる", async () => {
    await prisma.importLog.createMany({
      data: [
        { targetType: "shifts", createdCount: 1, updatedCount: 0, errorCount: 0 },
        { targetType: "shifts", createdCount: 2, updatedCount: 0, errorCount: 0 },
        { targetType: "employees", createdCount: 5, updatedCount: 0, errorCount: 0 },
      ],
    })

    const shiftsOnly = await getImportLogs({ page: 1, pageSize: 20 }, { targetType: "shifts" })
    expect(shiftsOnly.total).toBe(2)
    expect(shiftsOnly.data.every((l) => l.targetType === "shifts")).toBe(true)

    const all = await getImportLogs({ page: 1, pageSize: 20 })
    expect(all.total).toBe(3)
  })

  it("ページネーションが効く", async () => {
    const data = Array.from({ length: 25 }, () => ({
      targetType: "shifts",
      createdCount: 1,
      updatedCount: 0,
      errorCount: 0,
    }))
    await prisma.importLog.createMany({ data })

    const page1 = await getImportLogs({ page: 1, pageSize: 20 }, { targetType: "shifts" })
    expect(page1.data).toHaveLength(20)
    expect(page1.total).toBe(25)
    expect(page1.totalPages).toBe(2)

    const page2 = await getImportLogs({ page: 2, pageSize: 20 }, { targetType: "shifts" })
    expect(page2.data).toHaveLength(5)
  })
})
