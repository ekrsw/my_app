"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { dutyAssignmentSchema, dutyAssignmentBulkReplaceSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { validateDutyWithinShift } from "@/lib/shift-validation"
import type { Prisma } from "@/app/generated/prisma/client"

type DutyAssignmentInput = {
  employeeId: string
  dutyTypeId: number
  dutyDate: string
  startTime: string
  endTime: string
  note?: string
  title?: string
  reducesCapacity?: boolean
}

function validateAndParseDutyAssignment(data: DutyAssignmentInput) {
  const parsed = dutyAssignmentSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message } as const
  }
  return {
    data: {
      employeeId: parsed.data.employeeId,
      dutyTypeId: parsed.data.dutyTypeId,
      dutyDate: new Date(parsed.data.dutyDate),
      startTime: new Date(`1970-01-01T${parsed.data.startTime}Z`),
      endTime: new Date(`1970-01-01T${parsed.data.endTime}Z`),
      note: parsed.data.note ?? null,
      title: parsed.data.title ?? null,
      reducesCapacity: parsed.data.reducesCapacity,
      dutyStartHHMM: parsed.data.startTime.substring(0, 5),
      dutyEndHHMM: parsed.data.endTime.substring(0, 5),
    },
  } as const
}

export async function createDutyAssignment(data: DutyAssignmentInput) {
  await requireAuth()
  const result = validateAndParseDutyAssignment(data)
  if ("error" in result) {
    return { error: result.error }
  }
  const { data: parsed } = result

  try {
    await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: {
          employeeId_shiftDate: {
            employeeId: parsed.employeeId,
            shiftDate: parsed.dutyDate,
          },
        },
      })

      const validation = validateDutyWithinShift(
        shift,
        parsed.dutyStartHHMM,
        parsed.dutyEndHHMM
      )
      if (!validation.ok) {
        throw new ShiftValidationError(validation.error)
      }

      await tx.dutyAssignment.create({
        data: {
          employeeId: parsed.employeeId,
          dutyTypeId: parsed.dutyTypeId,
          dutyDate: parsed.dutyDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          note: parsed.note,
          title: parsed.title,
          reducesCapacity: parsed.reducesCapacity,
        },
      })
    })
    revalidatePath("/duty-assignments")
    revalidatePath("/")
    return { success: true }
  } catch (e: unknown) {
    if (e instanceof ShiftValidationError) {
      return { error: e.message }
    }
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この従業員・業務種別・日付・開始時刻の組み合わせは既に存在します" }
    }
    return { error: "業務割当の作成に失敗しました" }
  }
}

export async function updateDutyAssignment(
  id: number,
  data: DutyAssignmentInput
) {
  await requireAuth()
  const result = validateAndParseDutyAssignment(data)
  if ("error" in result) {
    return { error: result.error }
  }
  const { data: parsed } = result

  try {
    await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: {
          employeeId_shiftDate: {
            employeeId: parsed.employeeId,
            shiftDate: parsed.dutyDate,
          },
        },
      })

      const validation = validateDutyWithinShift(
        shift,
        parsed.dutyStartHHMM,
        parsed.dutyEndHHMM
      )
      if (!validation.ok) {
        throw new ShiftValidationError(validation.error)
      }

      await tx.dutyAssignment.update({
        where: { id },
        data: {
          employeeId: parsed.employeeId,
          dutyTypeId: parsed.dutyTypeId,
          dutyDate: parsed.dutyDate,
          startTime: parsed.startTime,
          endTime: parsed.endTime,
          note: parsed.note,
          title: parsed.title,
          reducesCapacity: parsed.reducesCapacity,
        },
      })
    })
    revalidatePath("/duty-assignments")
    revalidatePath("/")
    return { success: true }
  } catch (e: unknown) {
    if (e instanceof ShiftValidationError) {
      return { error: e.message }
    }
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この従業員・業務種別・日付・開始時刻の組み合わせは既に存在します" }
    }
    return { error: "業務割当の更新に失敗しました" }
  }
}

export async function deleteDutyAssignment(id: number) {
  await requireAuth()
  try {
    await prisma.dutyAssignment.delete({ where: { id } })
    revalidatePath("/duty-assignments")
    revalidatePath("/")
    return { success: true }
  } catch {
    return { error: "業務割当の削除に失敗しました" }
  }
}

class ShiftValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ShiftValidationError"
  }
}

type DutyAssignmentImportRow = {
  rowIndex: number
  dutyDate: string
  employeeName: string
  dutyTypeName: string
  startTime: string
  endTime: string
  title: string | null
  note: string | null
  reducesCapacity: boolean
}

type DutyAssignmentImportResult = {
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export async function importDutyAssignments(
  rows: DutyAssignmentImportRow[]
): Promise<DutyAssignmentImportResult> {
  await requireAuth()

  let created = 0
  let updated = 0
  const errors: Array<{ rowIndex: number; error: string }> = []

  for (const row of rows) {
    try {
      // 従業員名で検索
      const employees = await prisma.employee.findMany({
        where: { name: row.employeeName },
      })
      if (employees.length === 0) {
        errors.push({ rowIndex: row.rowIndex, error: `従業員「${row.employeeName}」が見つかりません` })
        continue
      }
      if (employees.length > 1) {
        errors.push({ rowIndex: row.rowIndex, error: `従業員「${row.employeeName}」が複数存在します` })
        continue
      }
      const employee = employees[0]

      // 業務種別名で検索
      const dutyType = await prisma.dutyType.findFirst({
        where: { name: row.dutyTypeName },
      })
      if (!dutyType) {
        errors.push({ rowIndex: row.rowIndex, error: `業務種別「${row.dutyTypeName}」が見つかりません` })
        continue
      }

      const dutyDate = new Date(row.dutyDate)
      const startTime = new Date(`1970-01-01T${row.startTime}Z`)
      const endTime = new Date(`1970-01-01T${row.endTime}Z`)

      // 既存の割当を検索（ユニーク制約: employeeId + dutyTypeId + dutyDate + startTime）
      const existing = await prisma.dutyAssignment.findUnique({
        where: {
          employeeId_dutyTypeId_dutyDate_startTime: {
            employeeId: employee.id,
            dutyTypeId: dutyType.id,
            dutyDate,
            startTime,
          },
        },
      })

      const data = {
        employeeId: employee.id,
        dutyTypeId: dutyType.id,
        dutyDate,
        startTime,
        endTime,
        title: row.title,
        note: row.note,
        reducesCapacity: row.reducesCapacity,
      }

      if (existing) {
        await prisma.dutyAssignment.update({
          where: { id: existing.id },
          data,
        })
        updated++
      } else {
        await prisma.dutyAssignment.create({ data })
        created++
      }
    } catch {
      errors.push({ rowIndex: row.rowIndex, error: "業務割当の保存に失敗しました" })
    }
  }

  revalidatePath("/duty-assignments")
  revalidatePath("/")
  return { created, updated, errors }
}

import { getDutyAssignmentsForCalendar, getBulkReplaceBatches } from "@/lib/db/duty-assignments"
import type { BulkReplaceBatchSummary } from "@/lib/db/duty-assignments"
import type { DutyAssignmentWithDetails, DutyCalendarFilterParams, DutyCalendarPaginatedResult } from "@/types/duties"

/** 一括置換の実行履歴を取得（クライアントから呼べる読み取りラッパー）。 */
export async function listBulkReplaceBatches(): Promise<BulkReplaceBatchSummary[]> {
  return getBulkReplaceBatches()
}

/** 月次カレンダーの追加データ読み込み（ページネーション用） */
export async function loadMoreDutyCalendarData(
  filter: DutyCalendarFilterParams,
  cursor: number
): Promise<DutyCalendarPaginatedResult> {
  const safeCursor = Math.max(0, Math.floor(Number(cursor) || 0))
  return getDutyAssignmentsForCalendar(filter, { cursor: safeCursor })
}

/** 業務割当の個別取得（編集用） */
export async function getDutyAssignmentById(
  id: number
): Promise<DutyAssignmentWithDetails | null> {
  const safeId = Math.floor(Number(id) || 0)
  if (safeId <= 0) return null

  const result = await prisma.dutyAssignment.findUnique({
    where: { id: safeId },
    include: {
      employee: {
        include: {
          groups: {
            include: { group: true },
            where: { endDate: null },
          },
        },
      },
      dutyType: true,
    },
  })

  return result
}

// ============================================================
// 業務割当の一括置換（業務種別の統廃合）
// ============================================================
//
// 用途: 業務種別A(複数可)を廃止し、その割当を全期間 業務種別B へ付け替える。
//
//   元種別の全割当 ──┬─ 衝突なし ─→ dutyTypeId を B へ更新 ＋ item に旧種別を記録
//                     └─ 衝突あり ─→ スキップ（A を残す。skippedCount に計上）
//
//   衝突 = 置換すると @@unique([employeeId, dutyTypeId, dutyDate, startTime]) に当たる:
//     (1) 同(emp,date,startTime) に既に B が存在
//     (2) 同(emp,date,startTime) にマッチ行が複数 → id 最小の1件のみ置換
//
//   Undo: batch ＋ item(割当ID×旧種別) を記録し、「実際に変えた行だけ」をガード付きで復元。
//   ※「逆置換(B→A)」では元々Bだった行やスキップ行を巻き込み非可逆に壊すため item 方式にする。

class BulkReplaceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BulkReplaceError"
  }
}

type BulkReplacePlanRow = { id: number; previousDutyTypeId: number }
type BulkReplacePlan = {
  matched: number
  skipped: number
  replaceRows: BulkReplacePlanRow[]
}

/**
 * 置換計画を算出する（プレビュー・実行で共通／読み取りのみ）。
 * matchedRows は id 昇順で走査し、衝突キーは id 最小を残して以降をスキップする（決定的）。
 */
async function computeBulkReplacePlan(
  client: Prisma.TransactionClient,
  fromDutyTypeIds: number[],
  toDutyTypeId: number
): Promise<BulkReplacePlan> {
  const matchedRows = await client.dutyAssignment.findMany({
    where: { dutyTypeId: { in: fromDutyTypeIds } },
    select: { id: true, employeeId: true, dutyDate: true, startTime: true, dutyTypeId: true },
    orderBy: { id: "asc" },
  })
  if (matchedRows.length === 0) {
    return { matched: 0, skipped: 0, replaceRows: [] }
  }

  const existingTargets = await client.dutyAssignment.findMany({
    where: { dutyTypeId: toDutyTypeId },
    select: { employeeId: true, dutyDate: true, startTime: true },
  })

  const keyOf = (r: { employeeId: string; dutyDate: Date; startTime: Date }) =>
    `${r.employeeId}|${r.dutyDate.toISOString()}|${r.startTime.toISOString()}`

  const existingKeys = new Set(existingTargets.map(keyOf))
  const seenKeys = new Set<string>()
  const replaceRows: BulkReplacePlanRow[] = []
  let skipped = 0

  for (const row of matchedRows) {
    const key = keyOf(row)
    // (1) 既存Bと衝突 / (2) バッチ内で同キー2件目以降 → スキップ
    if (existingKeys.has(key) || seenKeys.has(key)) {
      skipped++
      continue
    }
    seenKeys.add(key)
    replaceRows.push({ id: row.id, previousDutyTypeId: row.dutyTypeId })
  }

  return { matched: matchedRows.length, skipped, replaceRows }
}

/** 一括置換のプレビュー（無変更・件数のみ）。読み取りなので認証不要。 */
export async function previewBulkReplaceDutyAssignments(input: {
  fromDutyTypeIds: number[]
  toDutyTypeId: number
}): Promise<{ matched: number; toReplace: number; skipped: number } | { error: string }> {
  const parsed = dutyAssignmentBulkReplaceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const plan = await computeBulkReplacePlan(
    prisma,
    parsed.data.fromDutyTypeIds,
    parsed.data.toDutyTypeId
  )
  return { matched: plan.matched, toReplace: plan.replaceRows.length, skipped: plan.skipped }
}

/** 一括置換の実行（要認証）。バッチ＋item を記録し、非衝突行の dutyTypeId のみ更新する。 */
export async function executeBulkReplaceDutyAssignments(input: {
  fromDutyTypeIds: number[]
  toDutyTypeId: number
}): Promise<
  { error: string } | { replacedCount: number; skippedCount: number; batchId: number | null }
> {
  await requireAuth()
  const parsed = dutyAssignmentBulkReplaceSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const { fromDutyTypeIds, toDutyTypeId } = parsed.data
  const session = await auth()
  const executedBy = session?.user?.name ?? null

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const plan = await computeBulkReplacePlan(tx, fromDutyTypeIds, toDutyTypeId)

      // 対象0件 → バッチを作らず no-op
      if (plan.replaceRows.length === 0) {
        return { replacedCount: 0, skippedCount: plan.skipped, batchId: null }
      }

      const batch = await tx.dutyAssignmentBulkReplaceBatch.create({
        data: {
          fromDutyTypeIds,
          toDutyTypeId,
          replacedCount: plan.replaceRows.length,
          skippedCount: plan.skipped,
          executedBy,
        },
      })

      // item 記録（大量時はチャンク）
      const itemData = plan.replaceRows.map((r) => ({
        batchId: batch.id,
        dutyAssignmentId: r.id,
        previousDutyTypeId: r.previousDutyTypeId,
      }))
      for (let i = 0; i < itemData.length; i += 1000) {
        await tx.dutyAssignmentBulkReplaceItem.createMany({ data: itemData.slice(i, i + 1000) })
      }

      // dutyTypeId のみ更新（衝突行は plan に含まれないので制約違反は起きない）
      const ids = plan.replaceRows.map((r) => r.id)
      for (let i = 0; i < ids.length; i += 1000) {
        await tx.dutyAssignment.updateMany({
          where: { id: { in: ids.slice(i, i + 1000) } },
          data: { dutyTypeId: toDutyTypeId },
        })
      }

      return { replacedCount: plan.replaceRows.length, skippedCount: plan.skipped, batchId: batch.id }
    })

    revalidatePath("/duty-assignments")
    revalidatePath("/data")
    revalidatePath("/")
    return outcome
  } catch {
    return { error: "業務割当の一括置換に失敗しました" }
  }
}

/** 一括置換の取り消し（要認証）。実際に変えた行だけをガード付きで旧種別へ戻す。 */
export async function revertBulkReplaceDutyAssignments(
  batchId: number
): Promise<{ error: string } | { revertedCount: number; failedCount: number }> {
  await requireAuth()
  const session = await auth()
  const revertedBy = session?.user?.name ?? null
  const safeId = Math.floor(Number(batchId) || 0)
  if (safeId <= 0) return { error: "不正なバッチIDです" }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.dutyAssignmentBulkReplaceBatch.findUnique({
        where: { id: safeId },
        include: { items: true },
      })
      if (!batch) throw new BulkReplaceError("対象のバッチが見つかりません")
      if (batch.revertedAt) throw new BulkReplaceError("このバッチは既に取り消し済みです")

      // 旧種別が現存するか（削除済みだと FK Restrict で戻せない）
      const prevTypeIds = [...new Set(batch.items.map((i) => i.previousDutyTypeId))]
      const existingTypes = await tx.dutyType.findMany({
        where: { id: { in: prevTypeIds } },
        select: { id: true },
      })
      const existingTypeSet = new Set(existingTypes.map((t) => t.id))

      let revertedCount = 0
      let failedCount = 0

      for (const item of batch.items) {
        // 旧種別が削除済み → 戻せない
        if (!existingTypeSet.has(item.previousDutyTypeId)) {
          failedCount++
          continue
        }
        // ガード: 割当が現存し、現 dutyType が batch.toDutyTypeId のものだけ戻す
        // （実行後に手動で別種別へ変えた行 / 従業員削除で消えた行は触らない）
        const current = await tx.dutyAssignment.findUnique({
          where: { id: item.dutyAssignmentId },
          select: { id: true, dutyTypeId: true, employeeId: true, dutyDate: true, startTime: true },
        })
        if (!current || current.dutyTypeId !== batch.toDutyTypeId) {
          failedCount++
          continue
        }
        // 復元衝突: 同(emp,date,startTime) に旧種別が既に存在
        const conflict = await tx.dutyAssignment.findUnique({
          where: {
            employeeId_dutyTypeId_dutyDate_startTime: {
              employeeId: current.employeeId,
              dutyTypeId: item.previousDutyTypeId,
              dutyDate: current.dutyDate,
              startTime: current.startTime,
            },
          },
          select: { id: true },
        })
        if (conflict) {
          failedCount++
          continue
        }
        await tx.dutyAssignment.update({
          where: { id: item.dutyAssignmentId },
          data: { dutyTypeId: item.previousDutyTypeId },
        })
        revertedCount++
      }

      await tx.dutyAssignmentBulkReplaceBatch.update({
        where: { id: safeId },
        data: { revertedAt: new Date(), revertedBy },
      })

      return { revertedCount, failedCount }
    })

    revalidatePath("/duty-assignments")
    revalidatePath("/data")
    revalidatePath("/")
    return result
  } catch (e) {
    if (e instanceof BulkReplaceError) return { error: e.message }
    return { error: "一括置換の取り消しに失敗しました" }
  }
}
