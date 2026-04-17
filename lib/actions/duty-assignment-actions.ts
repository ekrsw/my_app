"use server"

import { prisma } from "@/lib/prisma"
import { dutyAssignmentSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"
import { getTimeHHMM } from "@/lib/capacity-utils"
import { validateDutyWithinShift } from "@/lib/shift-validation"

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

import { getDutyAssignmentsForDaily, getDutyAssignmentsForCalendar } from "@/lib/db/duty-assignments"
import type { DutyAssignmentWithDetails, DutyDailyFilterParams, DutyDailyPaginatedResult, DutyCalendarFilterParams, DutyCalendarPaginatedResult } from "@/types/duties"

/** 日次ビューの追加データ読み込み（無限スクロール用） */
export async function loadMoreDutyDailyData(
  params: DutyDailyFilterParams,
  cursor: number
): Promise<DutyDailyPaginatedResult> {
  const safeCursor = Math.max(0, Math.floor(Number(cursor) || 0))
  const safeDate = new Date(params.date)
  if (isNaN(safeDate.getTime())) {
    return { data: [], total: 0, hasMore: false, nextCursor: null }
  }
  return getDutyAssignmentsForDaily({ ...params, date: safeDate }, { cursor: safeCursor })
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
