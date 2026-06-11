// P1 バックフィルのコアロジック（テスト可能な純ロジック）。
//
// 暗号化拡張を通さない「生」の PrismaClient を受け取り、対象列の実値を読み、
// `v1:` でない（= 平文の）値だけを keyring.encrypt() して update する。
// keyring は呼び出し側で事前にアンロックしておくこと。
//
// 冪等: 既に `v1:` の行はスキップ。途中失敗からの再実行で続きを処理できる。

import type { PrismaClient } from "@/app/generated/prisma/client"
import * as keyring from "./keyring"

const CIPHER_PREFIX = "v1:"

/** 生クライアント（暗号化拡張なし）の最小要件。本番クライアント・raw クライアント双方を受ける。 */
type RawClient = Pick<PrismaClient, "dutyAssignment" | "dutyType">

function needsEncryption(value: string | null): value is string {
  return value != null && !value.startsWith(CIPHER_PREFIX)
}

export async function backfillDutyAssignments(client: RawClient): Promise<number> {
  const rows = await client.dutyAssignment.findMany({
    where: {
      OR: [
        { AND: [{ note: { not: null } }, { NOT: { note: { startsWith: CIPHER_PREFIX } } }] },
        { AND: [{ title: { not: null } }, { NOT: { title: { startsWith: CIPHER_PREFIX } } }] },
      ],
    },
    select: { id: true, note: true, title: true },
  })
  let updated = 0
  for (const row of rows) {
    const data: { note?: string; title?: string } = {}
    if (needsEncryption(row.note)) data.note = keyring.encrypt(row.note)
    if (needsEncryption(row.title)) data.title = keyring.encrypt(row.title)
    if (Object.keys(data).length === 0) continue
    await client.dutyAssignment.update({ where: { id: row.id }, data })
    updated++
  }
  return updated
}

export async function backfillDutyTypes(client: RawClient): Promise<number> {
  const rows = await client.dutyType.findMany({
    where: {
      OR: [
        { AND: [{ defaultNote: { not: null } }, { NOT: { defaultNote: { startsWith: CIPHER_PREFIX } } }] },
        { AND: [{ defaultTitle: { not: null } }, { NOT: { defaultTitle: { startsWith: CIPHER_PREFIX } } }] },
      ],
    },
    select: { id: true, defaultNote: true, defaultTitle: true },
  })
  let updated = 0
  for (const row of rows) {
    const data: { defaultNote?: string; defaultTitle?: string } = {}
    if (needsEncryption(row.defaultNote)) data.defaultNote = keyring.encrypt(row.defaultNote)
    if (needsEncryption(row.defaultTitle)) data.defaultTitle = keyring.encrypt(row.defaultTitle)
    if (Object.keys(data).length === 0) continue
    await client.dutyType.update({ where: { id: row.id }, data })
    updated++
  }
  return updated
}
