import { describe, it, expect, beforeEach, afterAll, vi } from "vitest"
import { PrismaClient } from "@/app/generated/prisma/client"
import { prisma } from "../helpers/prisma"
import * as keyring from "@/lib/crypto/keyring"
import { KeyringSealedError, isKeyringSealedError } from "@/lib/crypto/errors"
import { backfillDutyAssignments, backfillDutyTypes } from "@/lib/crypto/backfill-tier3"

// export ルートが参照する @/lib/prisma を、暗号化拡張済みのテストクライアントに差し替える。
vi.mock("@/lib/prisma", async () => ({
  prisma: (await import("../helpers/prisma")).prisma,
}))

const TEST_PASSPHRASE =
  process.env.KEYRING_TEST_PASSPHRASE ?? "test-keyring-passphrase-0123456789"

// 暗号化拡張を通さない「生」クライアント（at-rest の格納値を検証するため）。
const raw = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })

const DATE = new Date("2026-04-10")
const DATE2 = new Date("2026-04-11")
const START = new Date("1970-01-01T10:00:00Z")
const END = new Date("1970-01-01T12:00:00Z")

let employeeId: string
let dutyTypeId: number

beforeEach(async () => {
  await raw.$executeRawUnsafe(`TRUNCATE TABLE duty_assignments, duty_types, employees CASCADE`)
  if (!keyring.isUnlocked()) keyring.unlock(TEST_PASSPHRASE)
  const e = await raw.employee.create({ data: { name: "田中太郎" } })
  employeeId = e.id
  const dt = await raw.dutyType.create({ data: { name: "電話対応" } })
  dutyTypeId = dt.id
})

afterAll(async () => {
  await raw.$disconnect()
})

describe("Prisma 透過暗号化拡張: DutyAssignment", () => {
  it("note/title を暗号化保存し、復号して読み出す（ラウンドトリップ）", async () => {
    const created = await prisma.dutyAssignment.create({
      data: {
        employeeId,
        dutyTypeId,
        dutyDate: DATE,
        startTime: START,
        endTime: END,
        note: "機密メモ",
        title: "重要タイトル",
      },
    })
    // create の戻り値も復号済み
    expect(created.note).toBe("機密メモ")
    expect(created.title).toBe("重要タイトル")

    const read = await prisma.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(read.note).toBe("機密メモ")
    expect(read.title).toBe("重要タイトル")
  })

  it("at-rest では v1: 暗号文で格納される（平文を含まない）", async () => {
    // 旧 VarChar(100) を超える長さの title を使い、Text 化で切り詰められないことを検証する
    const longTitle = "重要タイトル".repeat(10) // 60文字 → 暗号文は100文字超
    const created = await prisma.dutyAssignment.create({
      data: { employeeId, dutyTypeId, dutyDate: DATE, startTime: START, endTime: END, note: "機密メモ", title: longTitle },
    })
    const stored = await raw.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(stored.note?.startsWith("v1:")).toBe(true)
    expect(stored.title?.startsWith("v1:")).toBe(true)
    expect(stored.note).not.toContain("機密メモ")
    // title 暗号文は旧 VarChar(100) を超えるが Text 化により切り詰められない
    expect(stored.title!.length).toBeGreaterThan(100)
    // 切り詰められていなければ正しく復号できる
    const read = await prisma.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(read.title).toBe(longTitle)
  })

  it("null の note/title は暗号化されず null のまま", async () => {
    const created = await prisma.dutyAssignment.create({
      data: { employeeId, dutyTypeId, dutyDate: DATE, startTime: START, endTime: END },
    })
    expect(created.note).toBeNull()
    expect(created.title).toBeNull()
    const stored = await raw.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(stored.note).toBeNull()
    expect(stored.title).toBeNull()
  })

  it("既に v1: の値は二重暗号化しない", async () => {
    const created = await prisma.dutyAssignment.create({
      data: { employeeId, dutyTypeId, dutyDate: DATE, startTime: START, endTime: END, note: "x" },
    })
    const cipher = (await raw.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })).note!
    expect(cipher.startsWith("v1:")).toBe(true)

    // 拡張クライアント経由で「既に暗号文の値」をそのまま書き戻す
    await prisma.dutyAssignment.update({ where: { id: created.id }, data: { note: cipher } })
    const after = (await raw.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })).note!
    expect(after).toBe(cipher) // 二重ラップされず不変

    const read = await prisma.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(read.note).toBe("x") // 1回だけ復号される
  })
})

describe("Prisma 透過暗号化拡張: DutyType defaults", () => {
  it("defaultNote/defaultTitle をラウンドトリップする", async () => {
    const created = await prisma.dutyType.create({
      data: { name: "研修", defaultNote: "既定メモ", defaultTitle: "既定タイトル" },
    })
    expect(created.defaultNote).toBe("既定メモ")
    expect(created.defaultTitle).toBe("既定タイトル")
    const read = await prisma.dutyType.findUniqueOrThrow({ where: { id: created.id } })
    expect(read.defaultNote).toBe("既定メモ")
    expect(read.defaultTitle).toBe("既定タイトル")
  })

  it("defaults は at-rest で v1: 暗号文として格納される", async () => {
    const created = await prisma.dutyType.create({
      data: { name: "会議", defaultNote: "既定メモ", defaultTitle: "既定タイトル" },
    })
    const stored = await raw.dutyType.findUniqueOrThrow({ where: { id: created.id } })
    expect(stored.defaultNote?.startsWith("v1:")).toBe(true)
    expect(stored.defaultTitle?.startsWith("v1:")).toBe(true)
    expect(stored.defaultNote).not.toContain("既定メモ")
  })
})

describe("duty-assignments export", () => {
  it("CSV に復号済み平文が出力される", async () => {
    await prisma.dutyAssignment.create({
      data: { employeeId, dutyTypeId, dutyDate: DATE, startTime: START, endTime: END, note: "機密メモ", title: "重要タイトル" },
    })
    const { GET } = await import("@/app/api/duty-assignments/export/route")
    const { NextRequest } = await import("next/server")
    const req = new NextRequest("http://localhost/api/duty-assignments/export?year=2026&month=4")
    const res = await GET(req)
    const text = await res.text()
    expect(text).toContain("機密メモ")
    expect(text).toContain("重要タイトル")
    expect(text).not.toContain("v1:")
  })
})

describe("sealed 時のフェイルクローズ", () => {
  it("sealed 中に暗号化列を読むと KeyringSealedError を投げる", async () => {
    await prisma.dutyAssignment.create({
      data: { employeeId, dutyTypeId, dutyDate: DATE, startTime: START, endTime: END, note: "x" },
    })
    keyring.lock()
    try {
      await expect(prisma.dutyAssignment.findMany()).rejects.toThrow(KeyringSealedError)
    } finally {
      keyring.unlock(TEST_PASSPHRASE)
    }
  })
})

describe("その他の書き込み形態でも暗号化される", () => {
  const baseData = () => ({
    employeeId,
    dutyTypeId,
    dutyDate: DATE,
    startTime: START,
    endTime: END,
  })
  const whereUnique = () => ({
    employeeId_dutyTypeId_dutyDate_startTime: {
      employeeId,
      dutyTypeId,
      dutyDate: DATE,
      startTime: START,
    },
  })

  it("upsert は create 直後も update 後も暗号化する", async () => {
    // create アーム
    await prisma.dutyAssignment.upsert({
      where: whereUnique(),
      create: { ...baseData(), note: "upsert作成" },
      update: { note: "未使用" },
    })
    let stored = await raw.dutyAssignment.findFirstOrThrow()
    expect(stored.note?.startsWith("v1:")).toBe(true)
    expect((await prisma.dutyAssignment.findFirstOrThrow()).note).toBe("upsert作成")

    // update アーム
    await prisma.dutyAssignment.upsert({
      where: whereUnique(),
      create: { ...baseData(), note: "未使用" },
      update: { note: "upsert更新" },
    })
    stored = await raw.dutyAssignment.findFirstOrThrow()
    expect(stored.note?.startsWith("v1:")).toBe(true)
    expect((await prisma.dutyAssignment.findFirstOrThrow()).note).toBe("upsert更新")
  })

  it("updateMany の data 内 note を暗号化する", async () => {
    const created = await prisma.dutyAssignment.create({ data: { ...baseData(), note: "x" } })
    await prisma.dutyAssignment.updateMany({
      where: { id: created.id },
      data: { note: "一括更新メモ" },
    })
    const stored = await raw.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(stored.note?.startsWith("v1:")).toBe(true)
    expect((await prisma.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })).note).toBe("一括更新メモ")
  })

  it("createMany の各行の note を暗号化する", async () => {
    await prisma.dutyAssignment.createMany({
      data: [
        { ...baseData(), note: "一括A" },
        { ...baseData(), dutyDate: DATE2, note: "一括B" },
      ],
    })
    const stored = await raw.dutyAssignment.findMany({ orderBy: { id: "asc" } })
    expect(stored.every((s) => s.note?.startsWith("v1:"))).toBe(true)
    const read = await prisma.dutyAssignment.findMany({ orderBy: { id: "asc" } })
    expect(read.map((r) => r.note)).toEqual(["一括A", "一括B"])
  })

  it("update の { set } 形式でも暗号化する", async () => {
    const created = await prisma.dutyAssignment.create({ data: { ...baseData(), note: "orig" } })
    await prisma.dutyAssignment.update({
      where: { id: created.id },
      data: { note: { set: "set形式メモ" } },
    })
    const stored = await raw.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })
    expect(stored.note?.startsWith("v1:")).toBe(true)
    expect((await prisma.dutyAssignment.findUniqueOrThrow({ where: { id: created.id } })).note).toBe("set形式メモ")
  })
})

describe("isKeyringSealedError", () => {
  it("KeyringSealedError インスタンスを true 判定する", () => {
    expect(isKeyringSealedError(new KeyringSealedError())).toBe(true)
  })
  it("name だけ一致するエラー（拡張越しの再 throw 想定）も true 判定する", () => {
    const e = new Error("sealed")
    e.name = "KeyringSealedError"
    expect(isKeyringSealedError(e)).toBe(true)
  })
  it("無関係なエラー・非エラーは false 判定する", () => {
    expect(isKeyringSealedError(new Error("other"))).toBe(false)
    expect(isKeyringSealedError(null)).toBe(false)
    expect(isKeyringSealedError("KeyringSealedError")).toBe(false)
  })
})

describe("同名の平文列を誤復号しない（モデル限定の復号）", () => {
  it("ShiftChangeHistory.note は v1: で始まっても復号を試みず素通しする", async () => {
    // ShiftChangeHistory.note は暗号化対象外（平文）。フィールド名が note でも、
    // 操作モデルが ShiftChangeHistory なら復号経路に乗ってはならない（throw も改変もしない）。
    await raw.$executeRawUnsafe(`TRUNCATE TABLE shift_change_history CASCADE`)
    const fakePlaintext = "v1:not.real.ciphertext"
    await raw.shiftChangeHistory.create({
      data: { shiftId: 999999, shiftDate: DATE, version: 1, note: fakePlaintext },
    })
    const rows = await prisma.shiftChangeHistory.findMany({ where: { shiftId: 999999 } })
    expect(rows).toHaveLength(1)
    expect(rows[0].note).toBe(fakePlaintext)
    await raw.$executeRawUnsafe(`TRUNCATE TABLE shift_change_history CASCADE`)
  })
})

describe("バックフィル（生クライアント経由）", () => {
  it("平文の既存行を暗号化し、再実行は冪等（0件）", async () => {
    // 拡張なしの raw クライアントで平文を直接投入
    await raw.dutyAssignment.create({
      data: { employeeId, dutyTypeId, dutyDate: DATE, startTime: START, endTime: END, note: "平文メモ", title: "平文タイトル" },
    })
    const first = await backfillDutyAssignments(raw)
    expect(first).toBe(1)
    const stored = (await raw.dutyAssignment.findFirst())!
    expect(stored.note?.startsWith("v1:")).toBe(true)
    expect(stored.title?.startsWith("v1:")).toBe(true)

    // 2回目は v1: 行をスキップ
    const second = await backfillDutyAssignments(raw)
    expect(second).toBe(0)

    // 拡張経由で読むと平文に戻る
    const read = (await prisma.dutyAssignment.findFirst())!
    expect(read.note).toBe("平文メモ")
    expect(read.title).toBe("平文タイトル")
  })

  it("一部のみ暗号化済みでも、未処理行だけ暗号化して再開できる", async () => {
    // 行A: 平文 / 行B: 既に暗号化済み（拡張クライアントで投入 → at-rest は v1:）
    await raw.dutyType.update({ where: { id: dutyTypeId }, data: { defaultNote: "平文A" } })
    await prisma.dutyType.create({ data: { name: "暗号済", defaultNote: "暗号B" } })

    const updated = await backfillDutyTypes(raw)
    expect(updated).toBe(1) // 平文Aの1件のみ

    const all = await raw.dutyType.findMany()
    for (const dt of all) {
      if (dt.defaultNote != null) expect(dt.defaultNote.startsWith("v1:")).toBe(true)
    }
  })
})
