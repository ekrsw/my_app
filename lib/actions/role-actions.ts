"use server"

import { prisma } from "@/lib/prisma"
import { functionRoleSchema, roleAssignmentSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth-guard"

export async function createFunctionRole(formData: FormData) {
  await requireAuth()
  const parsed = functionRoleSchema.safeParse({
    roleCode: formData.get("roleCode"),
    roleName: formData.get("roleName"),
    roleType: formData.get("roleType"),
    kind: formData.get("kind"),
    isActive: formData.get("isActive") === "true",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.functionRole.create({ data: parsed.data })
    revalidatePath("/roles")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このロールコードは既に使用されています" }
    }
    return { error: "ロールの作成に失敗しました" }
  }
}

export async function updateFunctionRole(id: number, formData: FormData) {
  await requireAuth()
  const parsed = functionRoleSchema.safeParse({
    roleCode: formData.get("roleCode"),
    roleName: formData.get("roleName"),
    roleType: formData.get("roleType"),
    kind: formData.get("kind"),
    isActive: formData.get("isActive") === "true",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.functionRole.update({
      where: { id },
      data: parsed.data,
    })
    revalidatePath("/roles")
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return { error: "このロールコードは既に使用されています" }
    }
    return { error: "ロールの更新に失敗しました" }
  }
}

export async function deleteFunctionRole(id: number) {
  await requireAuth()
  try {
    await prisma.functionRole.delete({ where: { id } })
    revalidatePath("/roles")
    return { success: true }
  } catch {
    return { error: "ロールの削除に失敗しました。割当中の従業員がいる場合は削除できません。" }
  }
}

export async function assignRole(data: {
  employeeId: string
  functionRoleId: number
  isPrimary?: boolean
  startDate?: string | null
  endDate?: string | null
}) {
  await requireAuth()
  const parsed = roleAssignmentSchema.safeParse(data)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.employeeFunctionRole.create({
      data: {
        employeeId: parsed.data.employeeId,
        functionRoleId: parsed.data.functionRoleId,
        isPrimary: parsed.data.isPrimary,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      },
    })
    revalidatePath("/roles")
    revalidatePath(`/employees/${parsed.data.employeeId}`)
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return {
        error: "この従業員には同じカテゴリのロールが既に割り当てられています。同一カテゴリのロールは1つしか持てません。",
      }
    }
    return { error: "ロールの割当に失敗しました" }
  }
}

export async function updateEmployeeRole(
  id: number,
  data: {
    isPrimary?: boolean
    startDate?: string | null
    endDate?: string | null
  }
) {
  await requireAuth()
  try {
    const updateData: {
      isPrimary?: boolean
      startDate?: Date | null
      endDate?: Date | null
    } = {}

    if (data.isPrimary !== undefined) {
      updateData.isPrimary = data.isPrimary
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? new Date(data.startDate) : null
    }
    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? new Date(data.endDate) : null
    }

    const updatedRole = await prisma.employeeFunctionRole.update({
      where: { id },
      data: updateData,
      select: { employeeId: true },
    })

    revalidatePath("/roles")
    if (updatedRole.employeeId) {
      revalidatePath(`/employees/${updatedRole.employeeId}`)
    }
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return {
        error: "この設定では制約違反が発生します。同一カテゴリのロールは1つしか持てません。",
      }
    }
    return { error: "ロールの更新に失敗しました" }
  }
}

export type RoleImportRow = {
  rowIndex: number
  employeeName: string
  roleCode: string
  isPrimary: boolean
  startDate: string | null
  endDate: string | null
}

export type RoleImportResult = {
  success: boolean
  created: number
  errors: Array<{ rowIndex: number; error: string }>
}

export async function importRoleAssignments(
  rows: RoleImportRow[]
): Promise<RoleImportResult> {
  await requireAuth()
  let created = 0
  const errors: Array<{ rowIndex: number; error: string }> = []

  try {
    await prisma.$transaction(async (tx) => {
      // 在籍従業員のみ取得（退職済みを除外）
      const allEmployees = await tx.employee.findMany({
        where: { terminationDate: null },
        select: { id: true, name: true },
      })

      // 名前→{id, count} マップ構築
      const nameCountMap = new Map<string, number>()
      const nameIdMap = new Map<string, string>()
      for (const emp of allEmployees) {
        const count = nameCountMap.get(emp.name) || 0
        nameCountMap.set(emp.name, count + 1)
        nameIdMap.set(emp.name, emp.id)
      }

      // アクティブなFunctionRoleのみ取得
      const allRoles = await tx.functionRole.findMany({
        where: { isActive: true },
      })
      const roleCodeMap = new Map(
        allRoles.map((r) => [r.roleCode, { id: r.id, roleType: r.roleType, kind: r.kind }])
      )

      // 既存アクティブ割当を取得（kind でカテゴリ衝突判定）
      const activeAssignments = await tx.employeeFunctionRole.findMany({
        where: { endDate: null },
        select: { employeeId: true, kind: true },
      })
      const activeAssignmentSet = new Set(
        activeAssignments
          .filter((a) => a.employeeId !== null)
          .map((a) => `${a.employeeId}-${a.kind}`)
      )

      // CSV内重複チェック用
      const csvSeenSet = new Set<string>()

      // 事前バリデーション
      for (const row of rows) {
        // 従業員名存在チェック
        if (!nameCountMap.has(row.employeeName)) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `従業員が見つかりません: ${row.employeeName}`,
          })
          continue
        }

        // 同姓同名チェック
        if ((nameCountMap.get(row.employeeName) || 0) > 1) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `同名の従業員が複数います: ${row.employeeName}`,
          })
          continue
        }

        // ロールコード存在チェック
        const roleInfo = roleCodeMap.get(row.roleCode)
        if (!roleInfo) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `存在しないロールコード: ${row.roleCode}`,
          })
          continue
        }

        const employeeId = nameIdMap.get(row.employeeName)!
        const assignmentKey = `${employeeId}-${roleInfo.kind}`

        // 既存アクティブ割当との kind 衝突チェック（同じ意味論カテゴリは1人1つ）
        if (activeAssignmentSet.has(assignmentKey)) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `既に同カテゴリのロールが割当済み: ${row.employeeName}, ${roleInfo.roleType}(${roleInfo.kind})`,
          })
          continue
        }

        // CSV内重複チェック
        if (csvSeenSet.has(assignmentKey)) {
          errors.push({
            rowIndex: row.rowIndex,
            error: `CSV内で重複: ${row.employeeName}, ${roleInfo.roleType}(${roleInfo.kind})`,
          })
          continue
        }
        csvSeenSet.add(assignmentKey)
      }

      // エラー行を除外して登録
      const errorRowIndices = new Set(errors.map((e) => e.rowIndex))

      for (const row of rows) {
        if (errorRowIndices.has(row.rowIndex)) continue

        const employeeId = nameIdMap.get(row.employeeName)!
        const roleInfo = roleCodeMap.get(row.roleCode)!

        try {
          await tx.employeeFunctionRole.create({
            data: {
              employeeId,
              functionRoleId: roleInfo.id,
              // roleType / kind はトリガー set_efr_role_type が function_roles から自動複製するが、
              // 明示的に渡して意図を記録する（トリガー未適用環境でのセーフティネットも兼ねる）。
              roleType: roleInfo.roleType,
              kind: roleInfo.kind,
              isPrimary: row.isPrimary,
              startDate: row.startDate ? new Date(row.startDate) : null,
              endDate: row.endDate ? new Date(row.endDate) : null,
            },
          })
          created++
        } catch {
          errors.push({
            rowIndex: row.rowIndex,
            error: "割当の作成に失敗しました",
          })
        }
      }
    })

    revalidatePath("/roles")
    revalidatePath("/employees")
    return { success: errors.length === 0, created, errors }
  } catch {
    return {
      success: false,
      created: 0,
      errors: errors.length > 0
        ? errors
        : [{ rowIndex: 0, error: "インポートに失敗しました" }],
    }
  }
}

export async function unassignRole(id: number) {
  await requireAuth()
  try {
    await prisma.employeeFunctionRole.update({
      where: { id },
      data: { endDate: new Date() },
    })
    revalidatePath("/roles")
    revalidatePath("/employees")
    return { success: true }
  } catch {
    return { error: "ロールの解除に失敗しました" }
  }
}
