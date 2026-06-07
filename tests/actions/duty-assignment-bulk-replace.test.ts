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
  previewBulkReplaceDutyAssignments,
  executeBulkReplaceDutyAssignments,
  revertBulkReplaceDutyAssignments,
} = await import("@/lib/actions/duty-assignment-actions")

// テスト用ヘルパー: 業務割当を1件作成
async function makeAssignment(
  employeeId: string,
  dutyTypeId: number,
  date: string,
  start: string,
  end = "12:00"
) {
  return prisma.dutyAssignment.create({
    data: {
      employeeId,
      dutyTypeId,
      dutyDate: new Date(date),
      startTime: new Date(`1970-01-01T${start}:00Z`),
      endTime: new Date(`1970-01-01T${end}:00Z`),
    },
  })
}

describe("業務割当の一括置換", () => {
  let employeeId: string
  let employeeId2: string
  let typeA: number
  let typeB: number
  let typeC: number

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignment_bulk_replace_item, duty_assignment_bulk_replace_batch, duty_assignments, duty_types CASCADE`
    )
    await cleanupDatabase()

    const e1 = await prisma.employee.create({ data: { name: "田中太郎" } })
    const e2 = await prisma.employee.create({ data: { name: "佐藤花子" } })
    employeeId = e1.id
    employeeId2 = e2.id

    const a = await prisma.dutyType.create({ data: { name: "電話対応A" } })
    const b = await prisma.dutyType.create({ data: { name: "電話対応B" } })
    const c = await prisma.dutyType.create({ data: { name: "事務C" } })
    typeA = a.id
    typeB = b.id
    typeC = c.id
  })

  describe("preview", () => {
    it("対象件数と実置換件数を返す（衝突なし）", async () => {
      await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      await makeAssignment(employeeId, typeA, "2026-04-11", "10:00")

      const result = await previewBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })

      expect(result).toEqual({ matched: 2, toReplace: 2, skipped: 0 })
    })

    it("既存Bと衝突する行はスキップに数える", async () => {
      // 同じ従業員・日・開始時刻に A と B が両方ある
      await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      await makeAssignment(employeeId, typeB, "2026-04-10", "10:00")
      // 衝突しない A
      await makeAssignment(employeeId, typeA, "2026-04-11", "10:00")

      const result = await previewBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })

      expect(result).toEqual({ matched: 2, toReplace: 1, skipped: 1 })
    })

    it("from==to はバリデーションエラー", async () => {
      const result = await previewBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeA,
      })
      expect("error" in result).toBe(true)
    })
  })

  describe("execute", () => {
    it("非衝突行の業務種別のみ置換し、他フィールドは不変", async () => {
      const a1 = await makeAssignment(employeeId, typeA, "2026-04-10", "10:00", "12:00")
      await makeAssignment(employeeId2, typeA, "2026-04-10", "13:00", "15:00")

      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })

      expect("error" in result).toBe(false)
      if ("error" in result) return
      expect(result.replacedCount).toBe(2)
      expect(result.skippedCount).toBe(0)

      const updated = await prisma.dutyAssignment.findUnique({ where: { id: a1.id } })
      expect(updated?.dutyTypeId).toBe(typeB)
      // 時刻・日付は不変
      expect(updated?.startTime.toISOString()).toBe(a1.startTime.toISOString())
      expect(updated?.endTime.toISOString()).toBe(a1.endTime.toISOString())
      expect(updated?.dutyDate.toISOString()).toBe(a1.dutyDate.toISOString())

      // 残りの A は 0 件
      const remainingA = await prisma.dutyAssignment.count({ where: { dutyTypeId: typeA } })
      expect(remainingA).toBe(0)
    })

    it("バッチとitemが記録され、executedBy が入る", async () => {
      const a1 = await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")

      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in result) throw new Error("unexpected error")

      const batch = await prisma.dutyAssignmentBulkReplaceBatch.findUnique({
        where: { id: result.batchId! },
        include: { items: true },
      })
      expect(batch?.executedBy).toBe("admin")
      expect(batch?.replacedCount).toBe(1)
      expect(batch?.items).toHaveLength(1)
      expect(batch?.items[0].dutyAssignmentId).toBe(a1.id)
      expect(batch?.items[0].previousDutyTypeId).toBe(typeA)
    })

    it("衝突行はスキップし、置換対象だけ更新する", async () => {
      await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      await makeAssignment(employeeId, typeB, "2026-04-10", "10:00") // 衝突相手
      await makeAssignment(employeeId, typeA, "2026-04-11", "10:00") // 置換可

      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in result) throw new Error("unexpected error")
      expect(result.replacedCount).toBe(1)
      expect(result.skippedCount).toBe(1)

      // 衝突した A は残る
      const remainingA = await prisma.dutyAssignment.count({ where: { dutyTypeId: typeA } })
      expect(remainingA).toBe(1)
    })

    it("複数の元種別を1つに統合できる", async () => {
      await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      await makeAssignment(employeeId, typeC, "2026-04-11", "10:00")

      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA, typeC],
        toDutyTypeId: typeB,
      })
      if ("error" in result) throw new Error("unexpected error")
      expect(result.replacedCount).toBe(2)

      const countB = await prisma.dutyAssignment.count({ where: { dutyTypeId: typeB } })
      expect(countB).toBe(2)
    })

    it("対象0件なら no-op（バッチを作らない）", async () => {
      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in result) throw new Error("unexpected error")
      expect(result.replacedCount).toBe(0)
      expect(result.batchId).toBeNull()
      const batches = await prisma.dutyAssignmentBulkReplaceBatch.count()
      expect(batches).toBe(0)
    })

    it("from==to は拒否", async () => {
      const result = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeA,
      })
      expect("error" in result).toBe(true)
    })
  })

  describe("revert", () => {
    it("置換した行を元の種別へ戻す", async () => {
      const a1 = await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      const exec = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in exec) throw new Error("unexpected error")

      const result = await revertBulkReplaceDutyAssignments(exec.batchId!)
      if ("error" in result) throw new Error("unexpected error")
      expect(result.revertedCount).toBe(1)
      expect(result.failedCount).toBe(0)

      const reverted = await prisma.dutyAssignment.findUnique({ where: { id: a1.id } })
      expect(reverted?.dutyTypeId).toBe(typeA)

      const batch = await prisma.dutyAssignmentBulkReplaceBatch.findUnique({
        where: { id: exec.batchId! },
      })
      expect(batch?.revertedAt).not.toBeNull()
      expect(batch?.revertedBy).toBe("admin")
    })

    it("取り消し済みバッチの再取り消しはエラー", async () => {
      await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      const exec = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in exec) throw new Error("unexpected error")
      await revertBulkReplaceDutyAssignments(exec.batchId!)

      const second = await revertBulkReplaceDutyAssignments(exec.batchId!)
      expect("error" in second).toBe(true)
    })

    it("実行後に手動で別種別へ変えた行は戻さない（ガード）", async () => {
      const a1 = await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      const exec = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in exec) throw new Error("unexpected error")

      // 実行後に手動で B→C へ変更
      await prisma.dutyAssignment.update({
        where: { id: a1.id },
        data: { dutyTypeId: typeC },
      })

      const result = await revertBulkReplaceDutyAssignments(exec.batchId!)
      if ("error" in result) throw new Error("unexpected error")
      expect(result.revertedCount).toBe(0)
      expect(result.failedCount).toBe(1)

      // 手動変更は維持される
      const after = await prisma.dutyAssignment.findUnique({ where: { id: a1.id } })
      expect(after?.dutyTypeId).toBe(typeC)
    })

    it("戻すと衝突する行はスキップして failedCount に数える", async () => {
      const a1 = await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")
      const exec = await executeBulkReplaceDutyAssignments({
        fromDutyTypeIds: [typeA],
        toDutyTypeId: typeB,
      })
      if ("error" in exec) throw new Error("unexpected error")

      // 同(emp,date,startTime) に旧種別 A を新規作成 → 復元すると衝突
      await makeAssignment(employeeId, typeA, "2026-04-10", "10:00")

      const result = await revertBulkReplaceDutyAssignments(exec.batchId!)
      if ("error" in result) throw new Error("unexpected error")
      expect(result.revertedCount).toBe(0)
      expect(result.failedCount).toBe(1)

      // 置換した a1 は B のまま
      const after = await prisma.dutyAssignment.findUnique({ where: { id: a1.id } })
      expect(after?.dutyTypeId).toBe(typeB)
    })
  })
})
