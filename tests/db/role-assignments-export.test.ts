import { describe, it, expect, beforeEach } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

import { vi } from "vitest"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getRoleAssignmentsForExport } = await import("@/lib/db/roles")

describe("getRoleAssignmentsForExport", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function createEmployee(name: string, terminationDate?: Date) {
    return prisma.employee.create({
      data: { name, terminationDate },
    })
  }

  async function createRole(roleCode: string, roleName: string, roleType: string) {
    return prisma.functionRole.create({
      data: { roleCode, roleName, roleType },
    })
  }

  async function createAssignment(
    employeeId: string,
    functionRoleId: number,
    options: { isPrimary?: boolean; startDate?: Date; endDate?: Date | null } = {}
  ) {
    return prisma.employeeFunctionRole.create({
      data: {
        employeeId,
        functionRoleId,
        isPrimary: options.isPrimary ?? false,
        startDate: options.startDate ?? null,
        endDate: options.endDate ?? null,
      },
    })
  }

  it("activeOnly=true はendDate: nullの割当のみ返す", async () => {
    const emp = await createEmployee("田中太郎")
    const role = await createRole("MGR", "マネージャー", "management")

    await createAssignment(emp.id, role.id, { endDate: null })
    await createAssignment(emp.id, role.id, {
      endDate: new Date("2025-03-31"),
    })

    const result = await getRoleAssignmentsForExport({ activeOnly: true })
    expect(result).toHaveLength(1)
    expect(result[0].endDate).toBeNull()
  })

  it("activeOnly=false は全割当を返す", async () => {
    const emp = await createEmployee("田中太郎")
    const role = await createRole("MGR", "マネージャー", "management")

    await createAssignment(emp.id, role.id, { endDate: null })
    await createAssignment(emp.id, role.id, {
      endDate: new Date("2025-03-31"),
    })

    const result = await getRoleAssignmentsForExport({ activeOnly: false })
    expect(result).toHaveLength(2)
  })

  it("退職した従業員の割当は除外される", async () => {
    const activeEmp = await createEmployee("田中太郎")
    const terminatedEmp = await createEmployee("佐藤花子", new Date("2025-01-31"))
    const role = await createRole("MGR", "マネージャー", "management")

    await createAssignment(activeEmp.id, role.id)
    await createAssignment(terminatedEmp.id, role.id)

    const result = await getRoleAssignmentsForExport({ activeOnly: false })
    expect(result).toHaveLength(1)
    expect(result[0].employee!.name).toBe("田中太郎")
  })

  it("従業員名昇順 → ロールコード昇順でソートされる", async () => {
    const empA = await createEmployee("あ田中")
    const empB = await createEmployee("い佐藤")
    const roleA = await createRole("AAA", "ロールA", "typeA")
    const roleB = await createRole("BBB", "ロールB", "typeB")

    await createAssignment(empA.id, roleB.id)
    await createAssignment(empA.id, roleA.id)
    await createAssignment(empB.id, roleA.id)

    const result = await getRoleAssignmentsForExport({ activeOnly: false })
    expect(result).toHaveLength(3)
    expect(result[0].employee!.name).toBe("あ田中")
    expect(result[0].functionRole!.roleCode).toBe("AAA")
    expect(result[1].employee!.name).toBe("あ田中")
    expect(result[1].functionRole!.roleCode).toBe("BBB")
    expect(result[2].employee!.name).toBe("い佐藤")
  })

  it("employeeやfunctionRoleの関連データが含まれる", async () => {
    const emp = await createEmployee("田中太郎")
    const role = await createRole("MGR", "マネージャー", "management")
    await createAssignment(emp.id, role.id, { isPrimary: true })

    const result = await getRoleAssignmentsForExport({ activeOnly: false })
    expect(result).toHaveLength(1)
    expect(result[0].employee).toBeDefined()
    expect(result[0].employee!.name).toBe("田中太郎")
    expect(result[0].functionRole).toBeDefined()
    expect(result[0].functionRole!.roleCode).toBe("MGR")
    expect(result[0].isPrimary).toBe(true)
  })
})
