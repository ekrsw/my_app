"use server"

import { prisma } from "@/lib/prisma"
import { shiftSchema, shiftBulkSchema, shiftHistoryNoteSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { getShiftsForCalendarPaginated, getShiftsForDaily } from "@/lib/db/shifts"
import { getShiftVersions } from "@/lib/db/history"
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
      },
    })
    revalidatePath("/")
    revalidatePath("/shifts")
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
        },
      })

      await tx.shiftChangeHistory.delete({
        where: { id: historyId },
      })
    })
    revalidatePath("/")
    revalidatePath("/shifts")
    revalidatePath("/shifts/history")
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
  }
) {
  await requireAuth()
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
        },
      })
    })
    revalidatePath("/")
    revalidatePath("/shifts")
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
        },
      })
    })
    revalidatePath("/shifts")
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
    revalidatePath("/shifts")
    revalidatePath("/shifts/history")
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
    revalidatePath("/shifts")
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
    revalidatePath("/shifts")
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
    revalidatePath("/shifts")
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
      },
    })

    revalidatePath("/shifts")
    revalidatePath("/shifts/history")
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
    // 従業員名→ID解決
    const nameOnlyRows = rows.filter((r) => r.employeeId === "" && r.employeeName)
    const uniqueNames = [...new Set(nameOnlyRows.map((r) => r.employeeName!))]
    const nameToIdMap = new Map<string, string>()
    const duplicateNames = new Set<string>()

    if (uniqueNames.length > 0) {
      const employeesByName = await prisma.employee.findMany({
        where: { name: { in: uniqueNames } },
        select: { id: true, name: true },
      })

      const nameCountMap = new Map<string, Array<{ id: string }>>()
      for (const emp of employeesByName) {
        const list = nameCountMap.get(emp.name) || []
        list.push({ id: emp.id })
        nameCountMap.set(emp.name, list)
      }

      for (const [name, emps] of nameCountMap) {
        if (emps.length === 1) {
          nameToIdMap.set(name, emps[0].id)
        } else {
          duplicateNames.add(name)
        }
      }
    }

    // 従業員名でID解決し、解決済み行を構築
    const resolvedRows: typeof rows = []
    for (const row of rows) {
      if (row.employeeId === "" && row.employeeName) {
        if (duplicateNames.has(row.employeeName)) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `従業員名 '${row.employeeName}' に該当する従業員が複数存在します。従業員IDを指定してください`,
          })
          continue
        }
        const resolvedId = nameToIdMap.get(row.employeeName)
        if (!resolvedId) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `従業員名 '${row.employeeName}' に該当する従業員が見つかりません`,
          })
          continue
        }
        resolvedRows.push({ ...row, employeeId: resolvedId })
      } else {
        resolvedRows.push(row)
      }
    }

    // 従業員IDの存在チェック用
    const employeeIds = [...new Set(resolvedRows.map((r) => r.employeeId))]
    const existingEmployees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true },
    })
    const existingEmployeeIds = new Set(existingEmployees.map((e) => e.id))

    // 従業員ID不正の行を除外
    const validRows: typeof rows = []
    for (const row of resolvedRows) {
      if (!existingEmployeeIds.has(row.employeeId)) {
        errors.push({ rowIndex: row.rowIndex, error: `従業員ID ${row.employeeId} が存在しません` })
      } else {
        validRows.push(row)
      }
    }

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
            for (const row of batch) {
              const shiftData = {
                shiftCode: row.shiftCode,
                startTime: row.startTime
                  ? new Date(`1970-01-01T${row.startTime}Z`)
                  : null,
                endTime: row.endTime
                  ? new Date(`1970-01-01T${row.endTime}Z`)
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

    revalidatePath("/shifts")
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

export async function fetchShiftVersions(shiftId: number) {
  try {
    const data = await getShiftVersions(shiftId)
    return { data }
  } catch {
    return { data: [], error: "バージョン一覧の取得に失敗しました" }
  }
}
