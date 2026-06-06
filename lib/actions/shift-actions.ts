"use server"

import { prisma } from "@/lib/prisma"
import { shiftSchema, shiftBulkSchema, shiftHistoryNoteSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { getShiftsForCalendarPaginated, getShiftsForDaily } from "@/lib/db/shifts"
import { getShiftVersions } from "@/lib/db/history"
import { resolveImportShiftRows } from "@/lib/import/resolve-shift-import"
import type { ShiftFilterParams, ShiftDailyFilterParams } from "@/types"
import type { ShiftCalendarPaginatedResult, ShiftDailyPaginatedResult } from "@/types/shifts"

export async function createShift(data: {
  employeeId: string
  shiftDate: string
  shiftCode?: string | null
  startTime?: string | null
  endTime?: string | null
  isHoliday?: boolean
  isRemote?: boolean
  lunchBreakStart?: string | null
  lunchBreakEnd?: string | null
}) {
  await requireAuth()
  const parsed = shiftSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.shift.create({
      data: {
        employeeId: parsed.data.employeeId,
        shiftDate: new Date(parsed.data.shiftDate),
        shiftCode: parsed.data.shiftCode ?? null,
        startTime: parsed.data.startTime
          ? new Date(`1970-01-01T${parsed.data.startTime}Z`)
          : null,
        endTime: parsed.data.endTime
          ? new Date(`1970-01-01T${parsed.data.endTime}Z`)
          : null,
        isHoliday: parsed.data.isHoliday,
        isRemote: parsed.data.isRemote,
        lunchBreakStart: parsed.data.lunchBreakStart
          ? new Date(`1970-01-01T${parsed.data.lunchBreakStart}Z`)
          : null,
        lunchBreakEnd: parsed.data.lunchBreakEnd
          ? new Date(`1970-01-01T${parsed.data.lunchBreakEnd}Z`)
          : null,
      },
    })
    revalidatePath("/")
    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この従業員・日付のシフトは既に存在します" }
    }
    return { error: "シフトの作成に失敗しました" }
  }
}

export async function getShiftById(shiftId: number) {
  return prisma.shift.findUnique({ where: { id: shiftId } })
}

export async function getShiftByEmployeeAndDate(employeeId: string, shiftDate: string) {
  return prisma.shift.findUnique({
    where: {
      employeeId_shiftDate: {
        employeeId,
        shiftDate: new Date(shiftDate),
      },
    },
  })
}

export async function revertShiftFromAttendance(
  shiftId: number,
  historyId: number,
) {
  await requireAuth()
  try {
    const history = await prisma.shiftChangeHistory.findUnique({
      where: { id: historyId },
    })
    if (!history) {
      return { error: "変更履歴が見つかりません" }
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.skip_shift_history', 'true', true)`

      await tx.shift.update({
        where: { id: shiftId },
        data: {
          shiftCode: history.shiftCode,
          startTime: history.startTime,
          endTime: history.endTime,
          isHoliday: history.isHoliday ?? false,
          isRemote: history.isRemote ?? false,
          lunchBreakStart: history.lunchBreakStart,
          lunchBreakEnd: history.lunchBreakEnd,
        },
      })

      await tx.shiftChangeHistory.delete({
        where: { id: historyId },
      })
    })
    revalidatePath("/")
    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true }
  } catch {
    return { error: "変更の取消に失敗しました" }
  }
}

export async function updateShiftFromAttendance(
  shiftId: number,
  historyId: number,
  data: {
    shiftCode?: string | null
    startTime?: string | null
    endTime?: string | null
    isHoliday?: boolean
    isRemote?: boolean
    note?: string | null
    lunchBreakStart?: string | null
    lunchBreakEnd?: string | null
  }
) {
  await requireAuth()
  if (data.note != null && data.note.length > 255) {
    return { error: "255文字以内で入力してください" }
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.skip_shift_history', 'true', true)`

      await tx.shift.update({
        where: { id: shiftId },
        data: {
          shiftCode: data.shiftCode,
          startTime: data.startTime
            ? new Date(`1970-01-01T${data.startTime}Z`)
            : null,
          endTime: data.endTime
            ? new Date(`1970-01-01T${data.endTime}Z`)
            : null,
          isHoliday: data.isHoliday,
          isRemote: data.isRemote,
          lunchBreakStart: data.lunchBreakStart !== undefined
            ? (data.lunchBreakStart ? new Date(`1970-01-01T${data.lunchBreakStart}Z`) : null)
            : undefined,
          lunchBreakEnd: data.lunchBreakEnd !== undefined
            ? (data.lunchBreakEnd ? new Date(`1970-01-01T${data.lunchBreakEnd}Z`) : null)
            : undefined,
        },
      })

      await tx.shiftChangeHistory.update({
        where: { id: historyId },
        data: {
          newShiftCode: data.shiftCode ?? null,
          newStartTime: data.startTime
            ? new Date(`1970-01-01T${data.startTime}Z`)
            : null,
          newEndTime: data.endTime
            ? new Date(`1970-01-01T${data.endTime}Z`)
            : null,
          newIsHoliday: data.isHoliday ?? false,
          newIsRemote: data.isRemote ?? false,
          newLunchBreakStart: data.lunchBreakStart !== undefined
            ? (data.lunchBreakStart ? new Date(`1970-01-01T${data.lunchBreakStart}Z`) : null)
            : undefined,
          newLunchBreakEnd: data.lunchBreakEnd !== undefined
            ? (data.lunchBreakEnd ? new Date(`1970-01-01T${data.lunchBreakEnd}Z`) : null)
            : undefined,
          note: data.note,
        },
      })
    })
    revalidatePath("/")
    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true }
  } catch {
    return { error: "勤怠の更新に失敗しました" }
  }
}

export async function updateShift(
  id: number,
  data: {
    shiftCode?: string | null
    startTime?: string | null
    endTime?: string | null
    isHoliday?: boolean
    isRemote?: boolean
    note?: string | null
    skipHistory?: boolean
    lunchBreakStart?: string | null
    lunchBreakEnd?: string | null
  }
) {
  await requireAuth()
  try {
    await prisma.$transaction(async (tx) => {
      if (data.skipHistory) {
        await tx.$executeRaw`SELECT set_config('app.skip_shift_history', 'true', true)`
      }
      if (data.note) {
        await tx.$executeRaw`SELECT set_config('app.shift_note', ${data.note}, true)`
      }
      await tx.shift.update({
        where: { id },
        data: {
          shiftCode: data.shiftCode,
          startTime: data.startTime
            ? new Date(`1970-01-01T${data.startTime}Z`)
            : null,
          endTime: data.endTime
            ? new Date(`1970-01-01T${data.endTime}Z`)
            : null,
          isHoliday: data.isHoliday,
          isRemote: data.isRemote,
          lunchBreakStart: data.lunchBreakStart !== undefined
            ? (data.lunchBreakStart ? new Date(`1970-01-01T${data.lunchBreakStart}Z`) : null)
            : undefined,
          lunchBreakEnd: data.lunchBreakEnd !== undefined
            ? (data.lunchBreakEnd ? new Date(`1970-01-01T${data.lunchBreakEnd}Z`) : null)
            : undefined,
        },
      })
    })
    revalidatePath("/")
    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true }
  } catch {
    return { error: "シフトの更新に失敗しました" }
  }
}

export async function getLatestShiftNote(shiftId: number): Promise<string | null> {
  const history = await prisma.shiftChangeHistory.findFirst({
    where: { shiftId },
    orderBy: { changedAt: "desc" },
    select: { note: true },
  })
  return history?.note ?? null
}

export async function deleteShift(id: number) {
  await requireAuth()
  try {
    await prisma.shift.delete({ where: { id } })
    revalidatePath("/")
    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true }
  } catch {
    return { error: "シフトの削除に失敗しました" }
  }
}

export async function bulkUpdateShifts(data: {
  shiftIds: number[]
  shiftCode?: string | null
  startTime?: string | null
  endTime?: string | null
  isHoliday?: boolean
  isRemote?: boolean
  note?: string | null
  skipHistory?: boolean
}) {
  await requireAuth()
  const parsed = shiftBulkSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}
  if (parsed.data.shiftCode !== undefined) updateData.shiftCode = parsed.data.shiftCode
  if (parsed.data.startTime !== undefined)
    updateData.startTime = parsed.data.startTime
      ? new Date(`1970-01-01T${parsed.data.startTime}Z`)
      : null
  if (parsed.data.endTime !== undefined)
    updateData.endTime = parsed.data.endTime
      ? new Date(`1970-01-01T${parsed.data.endTime}Z`)
      : null
  if (parsed.data.isHoliday !== undefined) updateData.isHoliday = parsed.data.isHoliday
  if (parsed.data.isRemote !== undefined) updateData.isRemote = parsed.data.isRemote

  try {
    await prisma.$transaction(async (tx) => {
      if (data.skipHistory) {
        await tx.$executeRaw`SELECT set_config('app.skip_shift_history', 'true', true)`
      }
      if (parsed.data.note) {
        await tx.$executeRaw`SELECT set_config('app.shift_note', ${parsed.data.note}, true)`
      }
      await tx.shift.updateMany({
        where: { id: { in: parsed.data.shiftIds } },
        data: updateData,
      })
    })
    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true, count: parsed.data.shiftIds.length }
  } catch {
    return { error: "一括更新に失敗しました" }
  }
}

export async function updateShiftHistory(id: number, data: { note: string }) {
  await requireAuth()
  const parsed = shiftHistoryNoteSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.shiftChangeHistory.update({
      where: { id },
      data: { note: parsed.data.note || null },
    })
    revalidatePath("/shifts/history")
    revalidatePath(`/shifts/history/${id}`)
    return { success: true }
  } catch {
    return { error: "備考の更新に失敗しました" }
  }
}

export async function deleteShiftHistory(id: number) {
  await requireAuth()
  try {
    await prisma.shiftChangeHistory.delete({ where: { id } })
    revalidatePath("/shifts/history")
    return { success: true }
  } catch {
    return { error: "変更履歴の削除に失敗しました" }
  }
}

export async function restoreShiftVersion(shiftId: number, version: number) {
  await requireAuth()
  try {
    const history = await prisma.shiftChangeHistory.findFirst({
      where: { shiftId, version },
    })

    if (!history) {
      return { error: "指定されたバージョンが見つかりません" }
    }

    await prisma.shift.update({
      where: { id: shiftId },
      data: {
        shiftCode: history.shiftCode,
        startTime: history.startTime,
        endTime: history.endTime,
        isHoliday: history.isHoliday ?? false,
        isRemote: history.isRemote ?? false,
        lunchBreakStart: history.lunchBreakStart,
        lunchBreakEnd: history.lunchBreakEnd,
      },
    })

    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: true }
  } catch {
    return { error: "バージョンの復元に失敗しました" }
  }
}

export type ShiftImportRow = {
  shiftDate: string
  employeeId: string
  employeeName?: string
  shiftCode: string | null
  startTime: string | null
  endTime: string | null
  lunchBreakStart?: string | null
  lunchBreakEnd?: string | null
  isHoliday: boolean
  isRemote: boolean
}

export type ShiftImportResult = {
  success: boolean
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export async function loadMoreCalendarData(
  filter: ShiftFilterParams,
  cursor: number,
  pageSize?: number
): Promise<ShiftCalendarPaginatedResult> {
  return getShiftsForCalendarPaginated(filter, { cursor, pageSize })
}

export async function loadMoreDailyData(
  filter: ShiftDailyFilterParams,
  cursor: number,
  pageSize?: number
): Promise<ShiftDailyPaginatedResult> {
  return getShiftsForDaily(filter, { cursor, pageSize })
}

const IMPORT_BATCH_SIZE = 200

export async function importShifts(
  rows: Array<ShiftImportRow & { rowIndex: number }>
): Promise<ShiftImportResult> {
  await requireAuth()
  let created = 0
  let updated = 0
  const errors: Array<{ rowIndex: number; error: string }> = []

  try {
    // 従業員の名前解決・存在チェック（プレビューの validateShiftImport と同一ロジック）
    const { validRows, errors: resolveErrors } = await resolveImportShiftRows(rows)
    errors.push(...resolveErrors)

    // バッチに分割して処理
    for (let i = 0; i < validRows.length; i += IMPORT_BATCH_SIZE) {
      const batch = validRows.slice(i, i + IMPORT_BATCH_SIZE)

      try {
        // バッチ内の既存シフトを一括取得
        const existingShifts = await prisma.shift.findMany({
          where: {
            OR: batch.map((r) => ({
              employeeId: r.employeeId,
              shiftDate: new Date(r.shiftDate),
            })),
          },
          select: { employeeId: true, shiftDate: true },
        })
        const existingSet = new Set(
          existingShifts.map((s) => `${s.employeeId}_${s.shiftDate.toISOString()}`)
        )

        await prisma.$transaction(
          async (tx) => {
            // CSVインポートはシフト変更履歴(shift_change_history)を残さない。
            // 履歴の本来用途は「予定 vs 勤怠実績」の突合であり、インポートによる
            // 予定の上書きはノイズになるため。set_config(...,true) はトランザクション
            // ローカルなので、バッチごとの各トランザクション内で都度設定する必要がある。
            await tx.$executeRaw`SELECT set_config('app.skip_shift_history', 'true', true)`
            for (const row of batch) {
              const shiftData = {
                shiftCode: row.shiftCode,
                startTime: row.startTime
                  ? new Date(`1970-01-01T${row.startTime}Z`)
                  : null,
                endTime: row.endTime
                  ? new Date(`1970-01-01T${row.endTime}Z`)
                  : null,
                lunchBreakStart: row.lunchBreakStart
                  ? new Date(`1970-01-01T${row.lunchBreakStart}Z`)
                  : null,
                lunchBreakEnd: row.lunchBreakEnd
                  ? new Date(`1970-01-01T${row.lunchBreakEnd}Z`)
                  : null,
                isHoliday: row.isHoliday,
                isRemote: row.isRemote,
              }

              const shiftDate = new Date(row.shiftDate)

              await tx.shift.upsert({
                where: {
                  employeeId_shiftDate: {
                    employeeId: row.employeeId,
                    shiftDate,
                  },
                },
                create: {
                  employeeId: row.employeeId,
                  shiftDate,
                  ...shiftData,
                },
                update: shiftData,
              })

              const key = `${row.employeeId}_${shiftDate.toISOString()}`
              if (existingSet.has(key)) {
                updated++
              } else {
                created++
              }
            }
          },
          { timeout: 30000 }
        )
      } catch {
        // バッチ単位でエラーを記録（他のバッチは続行）
        for (const row of batch) {
          errors.push({ rowIndex: row.rowIndex, error: "シフトデータの保存に失敗しました" })
        }
      }
    }

    revalidatePath("/shifts/history")
    revalidatePath("/duty-assignments")
    return { success: errors.length === 0, created, updated, errors }
  } catch {
    return {
      success: false,
      created: 0,
      updated: 0,
      errors: errors.length > 0
        ? errors
        : [{ rowIndex: 0, error: "インポート処理に失敗しました" }],
    }
  }
}

/**
 * インポート前のプレビュー検証。従業員名/IDの存在を確認し、行ごとのエラーを返す。
 * importShifts と同じ resolveImportShiftRows を使うため、ここで出るエラーと
 * 実行後に出るエラーは一致する。インフラ障害時は failed=true を返し、呼び出し側は
 * ブロックせず警告に留める（実行時に importShifts が再検証する）。
 */
export async function validateShiftImport(
  rows: Array<ShiftImportRow & { rowIndex: number }>
): Promise<{ errors: Array<{ rowIndex: number; error: string }>; failed: boolean }> {
  await requireAuth()
  try {
    const { errors } = await resolveImportShiftRows(rows)
    return { errors, failed: false }
  } catch {
    return { errors: [], failed: true }
  }
}

export async function fetchShiftVersions(shiftId: number) {
  try {
    const data = await getShiftVersions(shiftId)
    return { data }
  } catch {
    return { data: [], error: "バージョン一覧の取得に失敗しました" }
  }
}
