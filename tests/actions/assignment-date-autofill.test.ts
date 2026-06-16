import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"
import { resolveStartDate } from "@/lib/assignment-dates"

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }),
}))

const {
  createEmployee,
  updateEmployee,
  updateEmployeeWithRoles,
  addEmployeeGroup,
  addEmployeePosition,
} = await import("@/lib/actions/employee-actions")
const { assignRole } = await import("@/lib/actions/role-actions")

// テスト用の固定日付（JST 基準の @db.Date 比較に依存しない単純な日付）
const HIRE = "2025-04-01"
const HIRE_DATE = new Date(HIRE)
const LATER = "2025-10-01"
const EARLIER = "2025-01-01"

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe("assignment-dates: resolveStartDate (pure)", () => {
  it("明示的な開始日があればそれを優先（入社日があっても上書きしない）", () => {
    const explicit = new Date(LATER)
    expect(resolveStartDate(explicit, HIRE_DATE)).toBe(explicit)
  })

  it("開始日 null + 入社日あり → 入社日", () => {
    expect(resolveStartDate(null, HIRE_DATE)).toEqual(HIRE_DATE)
  })

  it("開始日 null + 入社日あり + 終了日 >= 入社日 → 入社日", () => {
    expect(resolveStartDate(null, HIRE_DATE, new Date(LATER))).toEqual(HIRE_DATE)
  })

  it("開始日 null + 入社日あり + 終了日 < 入社日 → null（範囲反転を避けて埋めない）", () => {
    expect(resolveStartDate(null, HIRE_DATE, new Date(EARLIER))).toBeNull()
  })

  it("開始日 null + 入社日 null → null", () => {
    expect(resolveStartDate(null, null)).toBeNull()
  })
})

describe("作成時補完（個別 add 関数）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("addEmployeeGroup: 開始日空欄 + 従業員に入社日 → 開始日に入社日", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })

    const result = await addEmployeeGroup({ employeeId: emp.id, groupId: group.id })
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toEqual(HIRE_DATE)
  })

  it("addEmployeeGroup: 明示的な開始日は上書きされない", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })

    await addEmployeeGroup({ employeeId: emp.id, groupId: group.id, startDate: LATER })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toEqual(new Date(LATER))
  })

  it("addEmployeeGroup: 入社日が無ければ開始日は null のまま", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田" } })

    await addEmployeeGroup({ employeeId: emp.id, groupId: group.id })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toBeNull()
  })

  it("assignRole: 開始日空欄 + 入社日 → 開始日に入社日", async () => {
    const role = await prisma.functionRole.create({
      data: { roleCode: "SV", roleName: "SV", kind: "SUPERVISOR" },
    })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })

    const result = await assignRole({ employeeId: emp.id, functionRoleId: role.id })
    expect(result).toEqual({ success: true })

    const efr = await prisma.employeeFunctionRole.findFirst({ where: { employeeId: emp.id } })
    expect(efr!.startDate).toEqual(HIRE_DATE)
  })

  it("addEmployeeGroup: 終了日 < 入社日 なら開始日は補完されず null（作成時の範囲反転ガード）", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })

    // 開始日空欄・終了日 EARLIER(入社日より前)。バリデーションは start 空欄なので通過。
    const result = await addEmployeeGroup({
      employeeId: emp.id,
      groupId: group.id,
      endDate: EARLIER,
    })
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    // 入社日(HIRE) > 終了日(EARLIER) なので補完されず null のまま
    expect(eg!.startDate).toBeNull()
    expect(eg!.endDate).toEqual(new Date(EARLIER))
  })

  it("addEmployeePosition: 開始日空欄 + 入社日 → 開始日に入社日", async () => {
    const pos = await prisma.position.create({
      data: { positionCode: "CHIEF", positionName: "主任" },
    })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })

    const result = await addEmployeePosition({ employeeId: emp.id, positionId: pos.id })
    expect(result).toEqual({ success: true })

    const ep = await prisma.employeePosition.findFirst({ where: { employeeId: emp.id } })
    expect(ep!.startDate).toEqual(HIRE_DATE)
  })
})

describe("createEmployee 作成時補完", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("入社日 + グループ指定 → グループ開始日に入社日（回帰）", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })

    const result = await createEmployee(
      fd({ name: "新人", hireDate: HIRE, groupId: String(group.id) }),
    )
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({})
    expect(eg!.startDate).toEqual(HIRE_DATE)
  })

  it("入社日なし + グループ指定 → グループ開始日 null", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })

    await createEmployee(fd({ name: "新人", groupId: String(group.id) }))

    const eg = await prisma.employeeGroup.findFirst({})
    expect(eg!.startDate).toBeNull()
  })
})

describe("updateEmployee 遡及補完（入社日）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("入社日 NULL→値 で、開始日が空欄の所属/ロール/役職すべてに入社日が入る", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const role = await prisma.functionRole.create({
      data: { roleCode: "SV", roleName: "SV", kind: "SUPERVISOR" },
    })
    const pos = await prisma.position.create({
      data: { positionCode: "CHIEF", positionName: "主任" },
    })
    const emp = await prisma.employee.create({ data: { name: "山田" } })
    await prisma.employeeGroup.create({ data: { employeeId: emp.id, groupId: group.id, startDate: null } })
    await prisma.employeeFunctionRole.create({ data: { employeeId: emp.id, functionRoleId: role.id, startDate: null } })
    await prisma.employeePosition.create({ data: { employeeId: emp.id, positionId: pos.id, startDate: null } })

    const result = await updateEmployee(emp.id, fd({ name: "山田", hireDate: HIRE }))
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    const efr = await prisma.employeeFunctionRole.findFirst({ where: { employeeId: emp.id } })
    const ep = await prisma.employeePosition.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toEqual(HIRE_DATE)
    expect(efr!.startDate).toEqual(HIRE_DATE)
    expect(ep!.startDate).toEqual(HIRE_DATE)
  })

  it("手入力済みの開始日は遡及補完で上書きされない", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: new Date(LATER) },
    })

    await updateEmployee(emp.id, fd({ name: "山田", hireDate: HIRE }))

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toEqual(new Date(LATER))
  })

  it("入社日 値→別の値 では遡及補完は走らない（空欄開始日は空欄のまま）", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })
    await prisma.employeeGroup.create({ data: { employeeId: emp.id, groupId: group.id, startDate: null } })

    await updateEmployee(emp.id, fd({ name: "山田", hireDate: LATER }))

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toBeNull()
  })

  it("【CRITICAL】終了日 < 入社日 のレコードはスキップ（daterange 反転例外を出さない）", async () => {
    const pos = await prisma.position.create({
      data: { positionCode: "CHIEF", positionName: "主任" },
    })
    const emp = await prisma.employee.create({ data: { name: "山田" } })
    // 開始日 null, 終了日 2025-01-01（入社日 2025-04-01 より前）
    await prisma.employeePosition.create({
      data: { employeeId: emp.id, positionId: pos.id, startDate: null, endDate: new Date(EARLIER) },
    })

    const result = await updateEmployee(emp.id, fd({ name: "山田", hireDate: HIRE }))
    // 例外で落ちず success、かつ開始日は null のまま
    expect(result).toEqual({ success: true })

    const ep = await prisma.employeePosition.findFirst({ where: { employeeId: emp.id } })
    expect(ep!.startDate).toBeNull()
    expect(ep!.endDate).toEqual(new Date(EARLIER))
  })
})

describe("updateEmployee 遡及補完（退職日）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("退職日 NULL→値 で、終了日が空欄のレコードに退職日が入る", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: HIRE_DATE, endDate: null },
    })

    const result = await updateEmployee(
      emp.id,
      fd({ name: "山田", hireDate: HIRE, terminationDate: LATER }),
    )
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.endDate).toEqual(new Date(LATER))
  })

  it("退職日 < 開始日 のレコードは終了日補完をスキップ", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    // 退職日 < 開始日 を作るため、開始日 LATER, 退職日 HIRE。
    // ただし employeeSchema は hireDate<=terminationDate のみ検証するので、
    // 入社日を空にして退職日のみ設定する。
    const emp = await prisma.employee.create({ data: { name: "山田" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: new Date(LATER), endDate: null },
    })

    const result = await updateEmployee(emp.id, fd({ name: "山田", terminationDate: HIRE }))
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    // 退職日(HIRE) < 開始日(LATER) なので終了日は補完されない
    expect(eg!.endDate).toBeNull()
  })

  it("手入力済みの終了日は上書きされない", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: new Date(EARLIER), endDate: new Date(HIRE) },
    })

    await updateEmployee(emp.id, fd({ name: "山田", terminationDate: LATER }))

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.endDate).toEqual(new Date(HIRE))
  })
})

describe("バリデーション: start ≤ end（手入力逆転の防止）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("updateEmployee: 入社日 > 退職日 はエラー（補完ロジックに到達しない）", async () => {
    const emp = await prisma.employee.create({ data: { name: "山田" } })

    const result = await updateEmployee(
      emp.id,
      fd({ name: "山田", hireDate: LATER, terminationDate: HIRE }),
    )
    expect(result).toHaveProperty("error")
  })

  it("addEmployeeGroup: 開始日 > 終了日 はエラー", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田" } })

    const result = await addEmployeeGroup({
      employeeId: emp.id,
      groupId: group.id,
      startDate: LATER,
      endDate: HIRE,
    })
    expect(result).toHaveProperty("error")
  })
})

describe("updateEmployeeWithRoles 遡及補完（parity）", () => {
  beforeEach(async () => {
    await cleanupDatabase()
  })

  it("入社日 NULL→値 で既存の空欄開始日が埋まる", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田" } })
    await prisma.employeeGroup.create({ data: { employeeId: emp.id, groupId: group.id, startDate: null } })

    const result = await updateEmployeeWithRoles(
      emp.id,
      { name: "山田", nameKana: null, hireDate: HIRE, terminationDate: null },
      [],
      [],
      [],
    )
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toEqual(HIRE_DATE)
  })

  it("追加行の開始日空欄も入社日（同コールで設定）で補完される", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田" } })

    const result = await updateEmployeeWithRoles(
      emp.id,
      { name: "山田", nameKana: null, hireDate: HIRE, terminationDate: null },
      [],
      [],
      [{ status: "added" as const, groupId: group.id }],
    )
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.startDate).toEqual(HIRE_DATE)
  })

  it("追加行のロール・役職も開始日空欄なら入社日で補完される", async () => {
    const role = await prisma.functionRole.create({
      data: { roleCode: "SV", roleName: "SV", kind: "SUPERVISOR" },
    })
    const pos = await prisma.position.create({
      data: { positionCode: "CHIEF", positionName: "主任" },
    })
    const emp = await prisma.employee.create({ data: { name: "山田" } })

    const result = await updateEmployeeWithRoles(
      emp.id,
      { name: "山田", nameKana: null, hireDate: HIRE, terminationDate: null },
      [{ status: "added" as const, functionRoleId: role.id }],
      [{ status: "added" as const, positionId: pos.id }],
      [],
    )
    expect(result).toEqual({ success: true })

    const efr = await prisma.employeeFunctionRole.findFirst({ where: { employeeId: emp.id } })
    const ep = await prisma.employeePosition.findFirst({ where: { employeeId: emp.id } })
    expect(efr!.startDate).toEqual(HIRE_DATE)
    expect(ep!.startDate).toEqual(HIRE_DATE)
  })

  it("退職日 NULL→値 で終了日が空欄の所属が補完される（parity・終了日経路）", async () => {
    const group = await prisma.group.create({ data: { name: "G1" } })
    const emp = await prisma.employee.create({ data: { name: "山田", hireDate: HIRE_DATE } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: group.id, startDate: HIRE_DATE, endDate: null },
    })

    const result = await updateEmployeeWithRoles(
      emp.id,
      { name: "山田", nameKana: null, hireDate: HIRE, terminationDate: LATER },
      [],
      [],
      [],
    )
    expect(result).toEqual({ success: true })

    const eg = await prisma.employeeGroup.findFirst({ where: { employeeId: emp.id } })
    expect(eg!.endDate).toEqual(new Date(LATER))
  })
})
