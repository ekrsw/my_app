// P1 バックフィル: Tier3 自由記述列（既存の平文）を暗号化する。
//
//   対象: DutyAssignment.note/title, DutyType.defaultNote/defaultTitle
//   - 列拡張マイグレーション（title/default_title → Text）適用後に実行すること。
//   - keyring を本プロセスでアンロックし（DEK をメモリに載せ）、
//     生の PrismaClient（暗号化拡張なし）で実値を読み、`v1:` でない値だけ暗号化して update。
//   - 冪等: 既に `v1:` の行はスキップ。クラッシュ後の再実行で続きから処理できる。
//
// 実行: npm run keyring:backfill-tier3
//   （要 secrets/keyring.json と運用パスフレーズ）

import { PrismaClient } from "../app/generated/prisma/client"
import * as keyring from "../lib/crypto/keyring"
import { backfillDutyAssignments, backfillDutyTypes } from "../lib/crypto/backfill-tier3"
import { promptHidden } from "./lib/prompt"

// 暗号化拡張を通さない生クライアント（実際の格納値を見るため）。
const prisma = new PrismaClient()

async function main() {
  const passphrase = await promptHidden("運用パスフレーズを入力: ")
  try {
    keyring.unlock(passphrase)
  } catch (e) {
    console.error(`アンロックに失敗しました: ${(e as Error).message}`)
    process.exit(1)
  }

  console.log("バックフィル開始（冪等・v1: 行はスキップ）…")
  const da = await backfillDutyAssignments(prisma)
  console.log(`  DutyAssignment: ${da} 行を暗号化`)
  const dt = await backfillDutyTypes(prisma)
  console.log(`  DutyType: ${dt} 行を暗号化`)
  console.log("✅ 完了")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    keyring.lock()
    await prisma.$disconnect()
  })
