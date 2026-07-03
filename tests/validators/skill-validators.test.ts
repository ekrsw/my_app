import { describe, it, expect } from "vitest"
import { skillSchema, skillLevelSchema } from "@/lib/validators"

describe("skillSchema（スキルマスタ）", () => {
  it("有効な入力を受け付ける", () => {
    const r = skillSchema.safeParse({
      skillCode: "EXCEL",
      skillName: "Excel操作",
      isActive: true,
      sortOrder: 1,
    })
    expect(r.success).toBe(true)
  })

  it("小文字を含むコードを拒否する", () => {
    const r = skillSchema.safeParse({
      skillCode: "Excel",
      skillName: "Excel操作",
    })
    expect(r.success).toBe(false)
  })

  it("空のスキル名を拒否する", () => {
    const r = skillSchema.safeParse({ skillCode: "EXCEL", skillName: "" })
    expect(r.success).toBe(false)
  })

  it("sortOrder 省略時は 0 になる", () => {
    const r = skillSchema.safeParse({ skillCode: "EXCEL", skillName: "Excel操作" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.sortOrder).toBe(0)
  })
})

describe("skillLevelSchema（レベル割当）", () => {
  const base = {
    employeeId: "00000000-0000-7000-8000-000000000000",
    skillId: 1,
  }

  it("レベル1〜5を受け付ける", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const r = skillLevelSchema.safeParse({ ...base, level })
      expect(r.success).toBe(true)
    }
  })

  it("レベル0を拒否する", () => {
    const r = skillLevelSchema.safeParse({ ...base, level: 0 })
    expect(r.success).toBe(false)
  })

  it("レベル6を拒否する", () => {
    const r = skillLevelSchema.safeParse({ ...base, level: 6 })
    expect(r.success).toBe(false)
  })

  it("非整数レベルを拒否する", () => {
    const r = skillLevelSchema.safeParse({ ...base, level: 2.5 })
    expect(r.success).toBe(false)
  })

  it("文字列レベルを数値に強制変換する", () => {
    const r = skillLevelSchema.safeParse({ ...base, level: "3" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.level).toBe(3)
  })

  it("不正なemployeeIdを拒否する", () => {
    const r = skillLevelSchema.safeParse({ ...base, employeeId: "not-uuid", level: 3 })
    expect(r.success).toBe(false)
  })

  it("startDateは省略可能", () => {
    const r = skillLevelSchema.safeParse({ ...base, level: 3 })
    expect(r.success).toBe(true)
  })
})
