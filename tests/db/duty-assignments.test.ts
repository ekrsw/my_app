import { describe, it, expect, beforeEach, vi } from "vitest"
import { prisma } from "../helpers/prisma"
import { cleanupDatabase } from "../helpers/cleanup"

vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})

const MOCK_TODAY = new Date("2025-06-15T00:00:00.000Z")

vi.mock("@/lib/date-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/date-utils")>()
  return {
    ...original,
    getTodayJST: () => MOCK_TODAY,
  }
})

const {
  getDutyAssignmentsForCalendar,
  getDailyDutyAssignments,
  getPreviousDayOvernightDutyAssignments,
} = await import("@/lib/db/duty-assignments")

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

describe("getDutyAssignmentsForCalendar", () => {
  let employeeId: string
  let dutyTypeId: number

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()

    const emp = await prisma.employee.create({ data: { name: "田中一郎" } })
    employeeId = emp.id

    const dt = await prisma.dutyType.create({
      data: { name: "日勤", sortOrder: 1 },
    })
    dutyTypeId = dt.id

    // 6月1日と6月15日に割当
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-01"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-15"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
  })

  it("従業員×日マトリクスを構築", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeName).toBe("田中一郎")
    expect(Object.keys(result.data[0].duties)).toHaveLength(2)
    expect(result.data[0].duties["2025-06-01"]).toHaveLength(1)
    expect(result.data[0].duties["2025-06-15"]).toHaveLength(1)

    // セルに note フィールドが含まれること
    const cell = result.data[0].duties["2025-06-01"][0]
    expect(cell).toHaveProperty("note")
    expect(cell.note).toBeNull()
  })

  it("note 付き割当がセルに反映される", async () => {
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-20"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: false,
        note: "テストメモ",
      },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const cell = result.data[0].duties["2025-06-20"]?.[0]
    expect(cell).toBeDefined()
    expect(cell.note).toBe("テストメモ")
  })

  it("title 付き割当がセルに反映される", async () => {
    await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: utcDate("2025-06-21"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        title: "A社訪問",
      },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const cell = result.data[0].duties["2025-06-21"]?.[0]
    expect(cell).toBeDefined()
    expect(cell.title).toBe("A社訪問")
  })

  it("title なし割当のセルは null", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const cell = result.data[0].duties["2025-06-01"]?.[0]
    expect(cell).toBeDefined()
    expect(cell.title).toBeNull()
  })

  it("dutyTypeSummary に集計データ", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.dutyTypeSummary).toHaveLength(1)
    expect(result.dutyTypeSummary[0].name).toBe("日勤")
    expect(result.dutyTypeSummary[0].count).toBe(2)
  })

  it("データなしの月 → 従業員は返るがdutiesは空", async () => {
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 1 })
    expect(result.data).toHaveLength(1)
    expect(Object.keys(result.data[0].duties)).toHaveLength(0)
    expect(result.dutyTypeSummary).toHaveLength(0)
  })

  it("groupIdsフィルター", async () => {
    const group = await prisma.group.create({ data: { name: "B班" } })
    await prisma.employeeGroup.create({
      data: { employeeId, groupId: group.id, startDate: null, endDate: null },
    })

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [group.id] })
    expect(result.data).toHaveLength(1)

    const resultEmpty = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [9999] })
    expect(resultEmpty.data).toHaveLength(0)
  })
})

// 期間オーバーラップ判定 / 月末スナップショットソート / Badge 表示用フィールド
// 設計書: docs/plans/duty-assignment-monthly-filter-spec.md
describe("getDutyAssignmentsForCalendar - 月次フィルター", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups, employee_function_roles CASCADE`
    )
    await cleanupDatabase()
  })

  it("月初に退職した従業員はその月に表示される", async () => {
    await prisma.employee.create({
      data: { name: "月初退職", terminationDate: utcDate("2025-06-01") },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].isTerminated).toBe(true)
    expect(result.data[0].terminationDate).toBe("2025-06-01")
  })

  it("月末に退職した従業員はその月に表示される", async () => {
    await prisma.employee.create({
      data: { name: "月末退職", terminationDate: utcDate("2025-06-30") },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].isTerminated).toBe(true)
  })

  it("翌月に退職する従業員もその月に表示される（在籍中扱い）", async () => {
    await prisma.employee.create({
      data: { name: "翌月退職予定", terminationDate: utcDate("2025-07-15") },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].isTerminated).toBe(false)
    expect(result.data[0].terminationDate).toBe("2025-07-15")
  })

  it("前月退職済みはその月には表示されない", async () => {
    await prisma.employee.create({
      data: { name: "前月退職", terminationDate: utcDate("2025-05-30") },
    })
    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(0)
  })

  it("月中異動 A→B: A・B どちらのグループフィルターでも表示される", async () => {
    const emp = await prisma.employee.create({ data: { name: "異動者" } })
    const groupA = await prisma.group.create({ data: { name: "A班" } })
    const groupB = await prisma.group.create({ data: { name: "B班" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: groupA.id, startDate: null, endDate: utcDate("2025-06-15") },
    })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: groupB.id, startDate: utcDate("2025-06-16"), endDate: null },
    })

    const byA = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [groupA.id] })
    expect(byA.data).toHaveLength(1)
    const byB = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [groupB.id] })
    expect(byB.data).toHaveLength(1)
  })

  it("月中異動者の groupNames は A と B 両方を含む（groupId 昇順）", async () => {
    const emp = await prisma.employee.create({ data: { name: "異動者" } })
    const groupA = await prisma.group.create({ data: { name: "A班" } })
    const groupB = await prisma.group.create({ data: { name: "B班" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: groupA.id, startDate: null, endDate: utcDate("2025-06-15") },
    })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: groupB.id, startDate: utcDate("2025-06-16"), endDate: null },
    })

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].groupNames).toEqual(["A班", "B班"])
  })

  it("複数グループ同時所属者はいずれかのフィルターで表示される", async () => {
    const emp = await prisma.employee.create({ data: { name: "兼務者" } })
    const groupX = await prisma.group.create({ data: { name: "X班" } })
    const groupY = await prisma.group.create({ data: { name: "Y班" } })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: groupX.id, startDate: null, endDate: null },
    })
    await prisma.employeeGroup.create({
      data: { employeeId: emp.id, groupId: groupY.id, startDate: null, endDate: null },
    })

    const byX = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, groupIds: [groupX.id] })
    expect(byX.data).toHaveLength(1)
    const byBoth = await getDutyAssignmentsForCalendar({
      year: 2025, month: 6, groupIds: [groupX.id, groupY.id],
    })
    expect(byBoth.data).toHaveLength(1)
  })

  it("未割当フィルターは月内有効所属が一つもない人だけを返す", async () => {
    const empAssigned = await prisma.employee.create({ data: { name: "所属あり" } })
    const empUnassigned = await prisma.employee.create({ data: { name: "未割当" } })
    const group = await prisma.group.create({ data: { name: "G班" } })
    await prisma.employeeGroup.create({
      data: { employeeId: empAssigned.id, groupId: group.id, startDate: null, endDate: null },
    })

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6, unassigned: true })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeId).toBe(empUnassigned.id)
  })

  it("月末非所属者（月中退職者）はソート末尾に並ぶ", async () => {
    const empA = await prisma.employee.create({ data: { name: "在籍中A" } })
    const empTerm = await prisma.employee.create({
      data: { name: "月中退職", terminationDate: utcDate("2025-06-15") },
    })
    const empB = await prisma.employee.create({ data: { name: "在籍中B" } })
    const groupSmall = await prisma.group.create({ data: { name: "小ID" } })
    const groupLarge = await prisma.group.create({ data: { name: "大ID" } })
    await prisma.employeeGroup.create({
      data: { employeeId: empA.id, groupId: groupSmall.id, startDate: null, endDate: null },
    })
    await prisma.employeeGroup.create({
      data: { employeeId: empB.id, groupId: groupLarge.id, startDate: null, endDate: null },
    })
    await prisma.employeeGroup.create({
      data: {
        employeeId: empTerm.id,
        groupId: groupSmall.id,
        startDate: null,
        endDate: utcDate("2025-06-15"),
      },
    })

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    // 月末時点グループID順: empA (小) → empB (大) → empTerm (月末非所属で末尾)
    expect(result.data.map((d) => d.employeeName)).toEqual([
      "在籍中A",
      "在籍中B",
      "月中退職",
    ])
  })
})

describe("getDailyDutyAssignments", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()
  })

  it("指定日の業務割当のみ返す(任意日付)", async () => {
    const emp = await prisma.employee.create({ data: { name: "山田太郎" } })
    const dt = await prisma.dutyType.create({
      data: { name: "日勤", sortOrder: 1 },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: utcDate("2025-03-10"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })

    const pastResult = await getDailyDutyAssignments(utcDate("2025-03-10"))
    expect(pastResult).toHaveLength(1)
    expect(pastResult[0].employee.name).toBe("山田太郎")

    const todayResult = await getDailyDutyAssignments(MOCK_TODAY)
    expect(todayResult).toHaveLength(1)

    const futureResult = await getDailyDutyAssignments(utcDate("2026-12-01"))
    expect(futureResult).toHaveLength(0)
  })

  it("terminationDate が指定日より前の従業員は除外", async () => {
    const empActive = await prisma.employee.create({ data: { name: "現職者" } })
    const empTerminated = await prisma.employee.create({
      data: { name: "退職者", terminationDate: utcDate("2025-05-01") },
    })
    const dt = await prisma.dutyType.create({ data: { name: "日勤", sortOrder: 1 } })

    // 両者とも 2025-06-15 の割当を持つ (MOCK_TODAY)
    for (const emp of [empActive, empTerminated]) {
      await prisma.dutyAssignment.create({
        data: {
          employeeId: emp.id, dutyTypeId: dt.id,
          dutyDate: MOCK_TODAY,
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
          reducesCapacity: true,
        },
      })
    }

    const result = await getDailyDutyAssignments(MOCK_TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].employee.name).toBe("現職者")
  })

  it("startTime昇順 → 従業員名昇順でソート", async () => {
    const emp1 = await prisma.employee.create({ data: { name: "佐藤" } })
    const emp2 = await prisma.employee.create({ data: { name: "鈴木" } })
    const dt = await prisma.dutyType.create({ data: { name: "日勤", sortOrder: 1 } })

    // 佐藤: 10:00開始、鈴木: 09:00開始 → 鈴木が先
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp1.id, dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T10:00:00Z"),
        endTime: new Date("1970-01-01T18:00:00Z"),
        reducesCapacity: true,
      },
    })
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp2.id, dutyTypeId: dt.id,
        dutyDate: MOCK_TODAY,
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })

    const result = await getDailyDutyAssignments(MOCK_TODAY)
    expect(result).toHaveLength(2)
    expect(result[0].employee.name).toBe("鈴木")
    expect(result[1].employee.name).toBe("佐藤")
  })
})

describe("getPreviousDayOvernightDutyAssignments", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups CASCADE`
    )
    await cleanupDatabase()
  })

  it("指定日の前日(=date-1)の夜勤業務のみ返す", async () => {
    const emp = await prisma.employee.create({ data: { name: "夜勤者" } })
    const dt = await prisma.dutyType.create({ data: { name: "夜勤", sortOrder: 1 } })

    // 過去日 (2025-03-10) の前日 = 2025-03-09 に夜勤
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: utcDate("2025-03-09"),
        startTime: new Date("1970-01-01T22:00:00Z"),
        endTime: new Date("1970-01-01T08:00:00Z"), // 翌朝まで
        reducesCapacity: true,
      },
    })

    const pastResult = await getPreviousDayOvernightDutyAssignments(utcDate("2025-03-10"))
    expect(pastResult).toHaveLength(1)

    // 2025-03-11 を渡すと前日=2025-03-10 → 夜勤なし
    const otherResult = await getPreviousDayOvernightDutyAssignments(utcDate("2025-03-11"))
    expect(otherResult).toHaveLength(0)
  })

  it("非深夜跨ぎは除外 (startTime <= endTime)", async () => {
    const emp = await prisma.employee.create({ data: { name: "日勤者" } })
    const dt = await prisma.dutyType.create({ data: { name: "日勤", sortOrder: 1 } })

    // 前日(2025-06-14)の日勤(9-17) — 深夜跨ぎではない
    await prisma.dutyAssignment.create({
      data: {
        employeeId: emp.id, dutyTypeId: dt.id,
        dutyDate: utcDate("2025-06-14"),
        startTime: new Date("1970-01-01T09:00:00Z"),
        endTime: new Date("1970-01-01T17:00:00Z"),
        reducesCapacity: true,
      },
    })

    const result = await getPreviousDayOvernightDutyAssignments(MOCK_TODAY)
    expect(result).toHaveLength(0)
  })
})


// employeeRoster: フィルター選択肢用の母集合（ページング・employeeIds・employeeSearch を反映しない）
// 設計書: ~/.gstack/projects/ekrsw-my_app/...-feature-duty-assignment-bulk-delete-design-*.md
describe("getDutyAssignmentsForCalendar - employeeRoster", () => {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE duty_assignments, duty_types, employee_groups, employee_function_roles CASCADE`
    )
    await cleanupDatabase()
  })

  it("(a) employeeIds/search なし: roster.length === total、1ページ目は data 50件で hasMore", async () => {
    // ページサイズ(50)を超える 51 人を作成
    for (let i = 0; i < 51; i++) {
      await prisma.employee.create({
        data: { name: `従業員${String(i).padStart(2, "0")}` },
      })
    }

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    expect(result.data).toHaveLength(50)
    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(51)
    // roster はページングを跨いで全員を含む
    expect(result.employeeRoster).toHaveLength(51)
    expect(result.employeeRoster.length).toBe(result.total)
  })

  it("loadMore (cursor>0) では roster を再計算せず空配列を返す", async () => {
    for (let i = 0; i < 51; i++) {
      await prisma.employee.create({
        data: { name: `従業員${String(i).padStart(2, "0")}` },
      })
    }

    const page2 = await getDutyAssignmentsForCalendar(
      { year: 2025, month: 6 },
      { cursor: 50 }
    )
    expect(page2.data).toHaveLength(1)
    expect(page2.employeeRoster).toEqual([])
  })

  it("(b) employeeIds 指定: total/data は縮むが roster は縮まない", async () => {
    const created: string[] = []
    for (let i = 0; i < 5; i++) {
      const emp = await prisma.employee.create({
        data: { name: `従業員${String(i).padStart(2, "0")}` },
      })
      created.push(emp.id)
    }

    const result = await getDutyAssignmentsForCalendar({
      year: 2025,
      month: 6,
      employeeIds: [created[0], created[1]],
    })
    // 選択した 2 人だけが data/total に反映される
    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(2)
    // roster は employeeIds を無視して全員を返す（選択しても候補が縮まない）
    expect(result.employeeRoster).toHaveLength(5)
  })

  it("employeeSearch を指定しても roster は縮まない", async () => {
    await prisma.employee.create({ data: { name: "田中一郎" } })
    await prisma.employee.create({ data: { name: "鈴木花子" } })

    const result = await getDutyAssignmentsForCalendar({
      year: 2025,
      month: 6,
      employeeSearch: "田中",
    })
    // data は検索で絞られる
    expect(result.data).toHaveLength(1)
    expect(result.data[0].employeeName).toBe("田中一郎")
    // roster は検索を無視して全員
    expect(result.employeeRoster).toHaveLength(2)
  })

  it("group フィルター適用時、roster は圏外の従業員を含まない", async () => {
    const groupA = await prisma.group.create({ data: { name: "A班" } })
    const empA = await prisma.employee.create({ data: { name: "Aさん" } })
    await prisma.employeeGroup.create({
      data: { employeeId: empA.id, groupId: groupA.id, startDate: null, endDate: null },
    })
    // 圏外（グループ未所属）
    await prisma.employee.create({ data: { name: "Bさん" } })

    const result = await getDutyAssignmentsForCalendar({
      year: 2025,
      month: 6,
      groupIds: [groupA.id],
    })
    expect(result.employeeRoster).toHaveLength(1)
    expect(result.employeeRoster[0].name).toBe("Aさん")
  })

  it("前月退職済みは roster に含まれず、月内在籍者は含まれる", async () => {
    await prisma.employee.create({ data: { name: "在籍者" } })
    await prisma.employee.create({
      data: { name: "前月退職者", terminationDate: utcDate("2025-05-31") },
    })

    const result = await getDutyAssignmentsForCalendar({ year: 2025, month: 6 })
    const names = result.employeeRoster.map((e) => e.name)
    expect(names).toContain("在籍者")
    expect(names).not.toContain("前月退職者")
  })
})
