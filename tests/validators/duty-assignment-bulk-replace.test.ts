import { describe, it, expect } from "vitest"
import { dutyAssignmentBulkReplaceSchema } from "@/lib/validators"

describe("dutyAssignmentBulkReplaceSchema", () => {
  it("正常系: from(複数)→to", () => {
    const r = dutyAssignmentBulkReplaceSchema.safeParse({
      fromDutyTypeIds: [1, 2],
      toDutyTypeId: 3,
    })
    expect(r.success).toBe(true)
  })

  it("from が空配列なら不可", () => {
    const r = dutyAssignmentBulkReplaceSchema.safeParse({
      fromDutyTypeIds: [],
      toDutyTypeId: 3,
    })
    expect(r.success).toBe(false)
  })

  it("to が from に含まれると不可", () => {
    const r = dutyAssignmentBulkReplaceSchema.safeParse({
      fromDutyTypeIds: [1, 2],
      toDutyTypeId: 2,
    })
    expect(r.success).toBe(false)
  })

  it("to 未指定（0以下）は不可", () => {
    const r = dutyAssignmentBulkReplaceSchema.safeParse({
      fromDutyTypeIds: [1],
      toDutyTypeId: 0,
    })
    expect(r.success).toBe(false)
  })

  it("文字列の数値は coerce される", () => {
    const r = dutyAssignmentBulkReplaceSchema.safeParse({
      fromDutyTypeIds: ["1", "2"],
      toDutyTypeId: "3",
    })
    expect(r.success).toBe(true)
  })
})
