import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const { getFunctionRoles, getFunctionRoleById, getEmployeeFunctionRoles } =
  await import("@/lib/db/roles")

async function createEmployee(name: string) {
  return prisma.employee.create({ data: { name } })
}

async function createRole(
  roleCode: string,
  roleName: string,
  roleType = "FUNCTION"
) {
  return prisma.functionRole.create({ data: { roleCode, roleName, roleType } })
}

async function assignRole(
  employeeId: string,
  functionRoleId: number,
  endDate: Date | null = null
) {
  return prisma.employeeFunctionRole.create({
    data: { employeeId, functionRoleId, endDate },
  })
}

describe("lib/db/roles", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  describe("getFunctionRoles", () => {
    it("全ロールを roleType 昇順・id 昇順で返す", async () => {
      const fn = await createRole("F1", "機能ロール", "FUNCTION")
      const adm = await createRole("A1", "管理ロール", "ADMIN")

      const result = await getFunctionRoles()

      expect(result).toHaveLength(2)
      // roleType 昇順: ADMIN が FUNCTION より先
      expect(result[0].id).toBe(adm.id)
      expect(result[1].id).toBe(fn.id)
    })

    it("roleType で絞り込める", async () => {
      await createRole("F1", "機能ロール", "FUNCTION")
      await createRole("A1", "管理ロール", "ADMIN")

      const result = await getFunctionRoles("ADMIN")

      expect(result).toHaveLength(1)
      expect(result[0].roleCode).toBe("A1")
    })

    it("_count.employeeRoles は endDate=null（現役）の割り当てのみ数える", async () => {
      const role = await createRole("F1", "機能ロール")
      const emp1 = await createEmployee("田中太郎")
      const emp2 = await createEmployee("佐藤花子")

      await assignRole(emp1.id, role.id, null) // 現役
      await assignRole(emp2.id, role.id, new Date("2020-01-01")) // 終了済み

      const result = await getFunctionRoles()

      expect(result[0]._count.employeeRoles).toBe(1)
    })

    it("ロールが無ければ空配列を返す", async () => {
      expect(await getFunctionRoles()).toEqual([])
    })
  })

  describe("getFunctionRoleById", () => {
    it("現役の割り当て従業員を name 昇順で返す", async () => {
      const role = await createRole("F1", "機能ロール")
      // ひらがな先頭文字の名前は照合順序非依存で同順になる
      // （Unicode コードポイント順・Japanese_Japan.932 等いずれも あ < や）
      const aoki = await createEmployee("あおき")
      const yamada = await createEmployee("やまだ")

      await assignRole(yamada.id, role.id, null)
      await assignRole(aoki.id, role.id, null)

      const result = await getFunctionRoleById(role.id)

      expect(result).not.toBeNull()
      expect(result!.employeeRoles).toHaveLength(2)
      expect(result!.employeeRoles[0].employee!.name).toBe("あおき")
      expect(result!.employeeRoles[1].employee!.name).toBe("やまだ")
    })

    it("終了済みの割り当ては含めない", async () => {
      const role = await createRole("F1", "機能ロール")
      const emp = await createEmployee("田中太郎")
      await assignRole(emp.id, role.id, new Date("2020-01-01"))

      const result = await getFunctionRoleById(role.id)

      expect(result!.employeeRoles).toHaveLength(0)
    })

    it("従業員の現役グループ所属を含める（endDate=null のみ）", async () => {
      const role = await createRole("F1", "機能ロール")
      const emp = await createEmployee("田中太郎")
      await assignRole(emp.id, role.id, null)

      const group1 = await prisma.group.create({ data: { name: "開発部" } })
      const group2 = await prisma.group.create({ data: { name: "旧営業部" } })
      await prisma.employeeGroup.create({
        data: { employeeId: emp.id, groupId: group1.id, endDate: null },
      })
      await prisma.employeeGroup.create({
        data: {
          employeeId: emp.id,
          groupId: group2.id,
          endDate: new Date("2020-01-01"),
        },
      })

      const result = await getFunctionRoleById(role.id)

      const groups = result!.employeeRoles[0].employee!.groups
      expect(groups).toHaveLength(1)
      expect(groups[0].group.name).toBe("開発部")
    })

    it("存在しない id は null を返す", async () => {
      expect(await getFunctionRoleById(999999)).toBeNull()
    })
  })

  describe("getEmployeeFunctionRoles", () => {
    it("指定従業員の全ロールを functionRole 付きで返す", async () => {
      const emp = await createEmployee("田中太郎")
      const role = await createRole("F1", "機能ロール")
      await assignRole(emp.id, role.id, null)

      const result = await getEmployeeFunctionRoles(emp.id)

      expect(result).toHaveLength(1)
      expect(result[0].functionRole!.roleCode).toBe("F1")
    })

    it("現役・終了済みの両方を返す（orderBy endDate asc, startDate desc）", async () => {
      const emp = await createEmployee("田中太郎")
      const roleActive = await createRole("F1", "現役ロール")
      const roleEnded = await createRole("F2", "終了ロール")
      await assignRole(emp.id, roleEnded.id, new Date("2020-01-01"))
      await assignRole(emp.id, roleActive.id, null)

      const result = await getEmployeeFunctionRoles(emp.id)

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.functionRole!.roleCode).sort()).toEqual([
        "F1",
        "F2",
      ])
    })

    it("他の従業員の割り当ては含めない", async () => {
      const emp1 = await createEmployee("田中太郎")
      const emp2 = await createEmployee("佐藤花子")
      const role = await createRole("F1", "機能ロール")
      await assignRole(emp1.id, role.id, null)
      await assignRole(emp2.id, role.id, null)

      const result = await getEmployeeFunctionRoles(emp1.id)

      expect(result).toHaveLength(1)
      expect(result[0].employeeId).toBe(emp1.id)
    })

    it("割り当てが無ければ空配列を返す", async () => {
      const emp = await createEmployee("田中太郎")
      expect(await getEmployeeFunctionRoles(emp.id)).toEqual([])
    })
  })
})
