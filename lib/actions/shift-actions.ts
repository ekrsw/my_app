"use server"

import { prisma } from "@/lib/prisma"
import { shiftSchema, shiftBulkSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export async function createShift(data: {
  employeeId: number
  shiftDate: string
  shiftCode?: string | null
  startTime?: string | null
  endTime?: string | null
  isHoliday?: boolean
  isPaidLeave?: boolean
  isRemote?: boolean
}) {
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
        isPaidLeave: parsed.data.isPaidLeave,
        isRemote: parsed.data.isRemote,
      },
    })
    revalidatePath("/shifts")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "この従業員・日付のシフトは既に存在します" }
    }
    return { error: "シフトの作成に失敗しました" }
  }
}

export async function updateShift(
  id: number,
  data: {
    shiftCode?: string | null
    startTime?: string | null
    endTime?: string | null
    isHoliday?: boolean
    isPaidLeave?: boolean
    isRemote?: boolean
  }
) {
  try {
    await prisma.shift.update({
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
        isPaidLeave: data.isPaidLeave,
        isRemote: data.isRemote,
      },
    })
    revalidatePath("/shifts")
    return { success: true }
  } catch {
    return { error: "シフトの更新に失敗しました" }
  }
}

export async function deleteShift(id: number) {
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
  isPaidLeave?: boolean
  isRemote?: boolean
}) {
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
  if (parsed.data.isPaidLeave !== undefined) updateData.isPaidLeave = parsed.data.isPaidLeave
  if (parsed.data.isRemote !== undefined) updateData.isRemote = parsed.data.isRemote

  try {
    await prisma.shift.updateMany({
      where: { id: { in: parsed.data.shiftIds } },
      data: updateData,
    })
    revalidatePath("/shifts")
    return { success: true, count: parsed.data.shiftIds.length }
  } catch {
    return { error: "一括更新に失敗しました" }
  }
}

export async function deleteShiftHistory(id: number) {
  try {
    await prisma.shiftChangeHistory.delete({ where: { id } })
    revalidatePath("/shifts")
    return { success: true }
  } catch {
    return { error: "変更履歴の削除に失敗しました" }
  }
}

export async function restoreShiftVersion(shiftId: number, version: number) {
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
        isPaidLeave: history.isPaidLeave ?? false,
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
  employeeId: number
  shiftCode: string | null
  startTime: string | null
  endTime: string | null
  isHoliday: boolean
  isPaidLeave: boolean
  isRemote: boolean
}

export type ShiftImportResult = {
  success: boolean
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export async function importShifts(
  rows: Array<ShiftImportRow & { rowIndex: number }>
): Promise<ShiftImportResult> {
  let created = 0
  let updated = 0
  const errors: Array<{ rowIndex: number; error: string }> = []

  try {
    // 従業員IDの存在チェック用
    const employeeIds = [...new Set(rows.map((r) => r.employeeId))]
    const existingEmployees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true },
    })
    const existingEmployeeIds = new Set(existingEmployees.map((e) => e.id))

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        if (!existingEmployeeIds.has(row.employeeId)) {
          errors.push({ rowIndex: row.rowIndex, error: `従業員ID ${row.employeeId} が存在しません` })
          continue
        }

        const data = {
          shiftCode: row.shiftCode,
          startTime: row.startTime
            ? new Date(`1970-01-01T${row.startTime}Z`)
            : null,
          endTime: row.endTime
            ? new Date(`1970-01-01T${row.endTime}Z`)
            : null,
          isHoliday: row.isHoliday,
          isPaidLeave: row.isPaidLeave,
          isRemote: row.isRemote,
        }

        // 既存シフトを確認
        const existing = await tx.shift.findUnique({
          where: {
            employeeId_shiftDate: {
              employeeId: row.employeeId,
              shiftDate: new Date(row.shiftDate),
            },
          },
        })

        if (existing) {
          await tx.shift.update({
            where: { id: existing.id },
            data,
          })
          updated++
        } else {
          await tx.shift.create({
            data: {
              employeeId: row.employeeId,
              shiftDate: new Date(row.shiftDate),
              ...data,
            },
          })
          created++
        }
      }
    })

    revalidatePath("/shifts")
    return { success: true, created, updated, errors }
  } catch {
    return { success: false, created: 0, updated: 0, errors: [{ rowIndex: 0, error: "インポート処理に失敗しました" }] }
  }
}
