// 初回セットアップ（本番サーバで1回）。
//   DEK 生成 → 運用パスフレーズ・リカバリコードの2鍵でラップ → keyring.json 書き出し。
//   リカバリコードは1回だけ表示する。DEK は画面に出さず即破棄する。
//
// 実行: npm run keyring:init

import { existsSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildKeyringFile,
  generateRecoveryCode,
  randomDek,
  writeKeyringFile,
} from "../lib/crypto/envelope"
import { promptHidden, promptVisible } from "./lib/prompt"

async function main() {
  const path = resolve(process.cwd(), process.env.KEYRING_PATH ?? "secrets/keyring.json")

  if (existsSync(path)) {
    console.error(`keyring が既に存在します: ${path}`)
    console.error("上書きは既存データの復号不能を招くため中止しました。")
    process.exit(1)
  }

  const pass1 = await promptHidden("運用パスフレーズを入力: ")
  if (pass1.length < 12) {
    console.error("パスフレーズは12文字以上にしてください。")
    process.exit(1)
  }
  const pass2 = await promptHidden("運用パスフレーズ(確認): ")
  if (pass1 !== pass2) {
    console.error("パスフレーズが一致しません。")
    process.exit(1)
  }

  const dek = randomDek()
  const recoveryCode = generateRecoveryCode()
  writeKeyringFile(path, buildKeyringFile(dek, pass1, recoveryCode))
  dek.fill(0)

  console.log(`\n✅ keyring を作成しました: ${path}\n`)
  console.log("============================================================")
  console.log(" リカバリコード（この1回だけ表示・オフライン保管）")
  console.log("")
  console.log("   " + recoveryCode)
  console.log("")
  console.log(" 運用パスフレーズとは別の安全な場所（金庫等・2拠点推奨）に保管。")
  console.log(" サーバーには保存されません。両方を失うと復旧不能です。")
  console.log("============================================================\n")

  const ack = await promptVisible("リカバリコードを安全に保管しましたか? [yes]: ")
  if (ack.toLowerCase() !== "yes") {
    console.log("※ 保管未確認。リカバリコードを保管してから運用に乗せてください（keyring は作成済み）。")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
