"use server"

import { prisma } from "@/lib/prisma"
import { employeeSchema } from "@/lib/validators"
import { revalidatePath } from "next/cache"

export type RoleChangeItem = {
  status: "added" | "modified" | "removed"
  id?: number // existing role id (for modified/removed)
  functionRoleId?: number
  isPrimary?: boolean
  startDate?: string | null
  endDate?: string | null
}

export type PositionChangeItem = {
  status: "added" | "modified" | "removed"
  id?: number // existing employee_position id (for modified/removed)
  positionId?: number
  startDate?: string | null
  endDate?: string | null
}

export type GroupChangeItem = {
  status: "added" | "modified" | "removed"
  id?: number // existing employee_group id (for modified/removed)
  groupId?: number
  startDate?: string | null
  endDate?: string | null
}

export async function createEmployee(formData: FormData) {
  const parsed = employeeSchema.safeParse({
    name: formData.get("name"),
    nameKana: formData.get("nameKana") || null,
    hireDate: formData.get("hireDate") || null,
    terminationDate: formData.get("terminationDate") || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const groupId = formData.get("groupId") ? Number(formData.get("groupId")) : null

  try {
    await prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          name: parsed.data.name,
          nameKana: parsed.data.nameKana ?? null,
          hireDate: parsed.data.hireDate
            ? new Date(parsed.data.hireDate)
            : null,
          terminationDate: parsed.data.terminationDate
            ? new Date(parsed.data.terminationDate)
            : null,
        },
      })

      if (groupId) {
        await tx.employeeGroup.create({
          data: {
            employeeId: employee.id,
            groupId,
            startDate: parsed.data.hireDate
              ? new Date(parsed.data.hireDate)
              : new Date(),
          },
        })
      }
    })

    revalidatePath("/employees")
    return { success: true }
  } catch {
    return { error: "従業員の作成に失敗しました" }
  }
}

export async function updateEmployee(id: number, formData: FormData) {
  const parsed = employeeSchema.safeParse({
    name: formData.get("name"),
    nameKana: formData.get("nameKana") || null,
    hireDate: formData.get("hireDate") || null,
    terminationDate: formData.get("terminationDate") || null,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const data = {
    name: parsed.data.name,
    nameKana: parsed.data.nameKana ?? null,
    hireDate: parsed.data.hireDate
      ? new Date(parsed.data.hireDate)
      : null,
    terminationDate: parsed.data.terminationDate
      ? new Date(parsed.data.terminationDate)
      : null,
  }

  try {
    await prisma.employee.update({ where: { id }, data })
    revalidatePath("/employees")
    revalidatePath(`/employees/${id}`)
    return { success: true }
  } catch {
    return { error: "従業員の更新に失敗しました" }
  }
}

export async function deleteEmployee(id: number) {
  try {
    await prisma.employee.delete({ where: { id } })
    revalidatePath("/employees")
    return { success: true }
  } catch {
    return { error: "従業員の削除に失敗しました。関連データがある場合は削除できません。" }
  }
}

export async function updateEmployeeWithRoles(
  id: number,
  employeeData: {
    name: string
    nameKana: string | null
    hireDate: string | null
    terminationDate: string | null
  },
  roleChanges: RoleChangeItem[],
  positionChanges: PositionChangeItem[] = [],
  groupChanges: GroupChangeItem[] = []
) {
  const parsed = employeeSchema.safeParse(employeeData)

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. 従業員基本情報更新（名前変更はDBトリガーで履歴化）
      await tx.employee.update({
        where: { id },
        data: {
          name: parsed.data.name,
          nameKana: parsed.data.nameKana ?? null,
          hireDate: parsed.data.hireDate
            ? new Date(parsed.data.hireDate)
            : null,
          terminationDate: parsed.data.terminationDate
            ? new Date(parsed.data.terminationDate)
            : null,
        },
      })

      // 2. 役割変更を処理（各操作はDBトリガーで履歴化）
      for (const change of roleChanges) {
        if (change.status === "added" && change.functionRoleId) {
          await tx.employeeFunctionRole.create({
            data: {
              employeeId: id,
              functionRoleId: change.functionRoleId,
              isPrimary: change.isPrimary ?? false,
              startDate: change.startDate ? new Date(change.startDate) : null,
              endDate: null,
            },
          })
        } else if (change.status === "modified" && change.id) {
          await tx.employeeFunctionRole.update({
            where: { id: change.id },
            data: {
              isPrimary: change.isPrimary,
              startDate: change.startDate ? new Date(change.startDate) : null,
              endDate: change.endDate ? new Date(change.endDate) : null,
            },
          })
        } else if (change.status === "removed" && change.id) {
          await tx.employeeFunctionRole.update({
            where: { id: change.id },
            data: { endDate: new Date() },
          })
        }
      }

      // 3. 役職変更を処理（各操作はDBトリガーで履歴化）
      for (const change of positionChanges) {
        if (change.status === "added" && change.positionId) {
          await tx.employeePosition.create({
            data: {
              employeeId: id,
              positionId: change.positionId,
              startDate: change.startDate ? new Date(change.startDate) : new Date(),
              endDate: null,
            },
          })
        } else if (change.status === "modified" && change.id) {
          await tx.employeePosition.update({
            where: { id: change.id },
            data: {
              startDate: change.startDate ? new Date(change.startDate) : undefined,
              endDate: change.endDate ? new Date(change.endDate) : null,
            },
          })
        } else if (change.status === "removed" && change.id) {
          await tx.employeePosition.update({
            where: { id: change.id },
            data: { endDate: new Date() },
          })
        }
      }

      // 4. グループ変更を処理（各操作はDBトリガーで履歴化）
      for (const change of groupChanges) {
        if (change.status === "added" && change.groupId) {
          await tx.employeeGroup.create({
            data: {
              employeeId: id,
              groupId: change.groupId,
              startDate: change.startDate ? new Date(change.startDate) : new Date(),
              endDate: null,
            },
          })
        } else if (change.status === "modified" && change.id) {
          await tx.employeeGroup.update({
            where: { id: change.id },
            data: {
              startDate: change.startDate ? new Date(change.startDate) : undefined,
              endDate: change.endDate ? new Date(change.endDate) : null,
            },
          })
        } else if (change.status === "removed" && change.id) {
          await tx.employeeGroup.update({
            where: { id: change.id },
            data: { endDate: new Date() },
          })
        }
      }
    })

    revalidatePath("/employees")
    revalidatePath(`/employees/${id}`)
    return { success: true }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "message" in e && typeof e.message === "string" && e.message.includes("employee_positions_no_overlap")) {
      return { error: "指定期間は既存の役職期間と重複しています" }
    }
    return { error: "従業員情報の更新に失敗しました" }
  }
}

export type EmployeeImportRow = {
  employeeId: number | null
  name: string
  nameKana: string | null
  hireDate: string | null
  terminationDate: string | null
  groupNames: string | null
}

export type EmployeeImportResult = {
  success: boolean
  created: number
  updated: number
  errors: Array<{ rowIndex: number; error: string }>
}

export async function importEmployees(
  rows: Array<EmployeeImportRow & { rowIndex: number }>
): Promise<EmployeeImportResult> {
  let created = 0
  let updated = 0
  const errors: Array<{ rowIndex: number; error: string }> = []

  try {
    await prisma.$transaction(async (tx) => {
      // グループ名→IDマップを作成
      const allGroups = await tx.group.findMany()
      const groupNameToId = new Map(allGroups.map((g) => [g.name, g.id]))

      // グループ名のバリデーション（先に全行チェック）
      for (const row of rows) {
        if (row.groupNames) {
          const names = row.groupNames.split("|").map((n) => n.trim()).filter(Boolean)
          const unknownNames = names.filter((n) => !groupNameToId.has(n))
          if (unknownNames.length > 0) {
            errors.push({
              rowIndex: row.rowIndex,
              error: `存在しないグループ: ${unknownNames.join(", ")}`,
            })
          }
        }
      }

      // エラーがある行を除外
      const errorRowIndices = new Set(errors.map((e) => e.rowIndex))

      const now = new Date()
      const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))

      for (const row of rows) {
        if (errorRowIndices.has(row.rowIndex)) continue

        const data = {
          name: row.name,
          nameKana: row.nameKana,
          hireDate: row.hireDate ? new Date(row.hireDate) : null,
          terminationDate: row.terminationDate ? new Date(row.terminationDate) : null,
        }

        // CSVのグループ名リストを解析
        const csvGroupIds: number[] | null = row.groupNames
          ? row.groupNames.split("|").map((n) => n.trim()).filter(Boolean).map((n) => groupNameToId.get(n)!)
          : null

        // IDあり → 既存を検索して更新、存在しなければ新規作成にフォールスルー
        let existingEmployeeId: number | null = null
        if (row.employeeId) {
          const existing = await tx.employee.findUnique({
            where: { id: row.employeeId },
          })
          if (existing) {
            existingEmployeeId = existing.id
            await tx.employee.update({ where: { id: existing.id }, data })
            updated++

            // グループ処理（nullの場合は変更しない）
            if (csvGroupIds !== null) {
              const activeGroups = await tx.employeeGroup.findMany({
                where: { employeeId: existing.id, endDate: null },
              })
              const activeGroupIds = new Set(activeGroups.map((g) => g.groupId))
              const csvGroupIdSet = new Set(csvGroupIds)

              // CSVにないアクティブグループ → 終了
              for (const ag of activeGroups) {
                if (!csvGroupIdSet.has(ag.groupId)) {
                  await tx.employeeGroup.update({
                    where: { id: ag.id },
                    data: { endDate: today },
                  })
                }
              }

              // CSVにあるが未所属のグループ → 追加
              for (const gid of csvGroupIds) {
                if (!activeGroupIds.has(gid)) {
                  await tx.employeeGroup.create({
                    data: {
                      employeeId: existing.id,
                      groupId: gid,
                      startDate: today,
                    },
                  })
                }
              }
            }
          }
        }

        // 既存従業員が見つからなかった場合 → 新規作成
        if (!existingEmployeeId) {
          const newEmployee = await tx.employee.create({ data })
          created++

          // 新規従業員のグループ登録
          if (csvGroupIds !== null && csvGroupIds.length > 0) {
            for (const gid of csvGroupIds) {
              await tx.employeeGroup.create({
                data: {
                  employeeId: newEmployee.id,
                  groupId: gid,
                  startDate: today,
                },
              })
            }
          }
        }
      }
    })

    revalidatePath("/employees")
    return { success: true, created, updated, errors }
  } catch {
    return { success: false, created: 0, updated: 0, errors: [{ rowIndex: 0, error: "インポート処理に失敗しました" }] }
  }
}
