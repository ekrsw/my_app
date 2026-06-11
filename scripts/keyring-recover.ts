// リカバリ（運用パスフレーズを失った時）。
//   リカバリコードで DEK を復元 → 新しい運用パスフレーズで再ラップ。
//   DEK は不変なのでデータの再暗号化は不要。
//
// 実行: npm run keyring:recover

import { randomBytes } from "node:crypto"
import { resolve } from "node:path"
import {
  readKeyringFile,
  unwrapDek,
  verifyDekCheck,
  wrapDek,
  writeKeyringFile,
} from "../lib/crypto/envelope"
import { promptHidden } from "./lib/prompt"

async function main() {
  const path = resolve(process.cwd(), process.env.KEYRING_PATH ?? "secrets/keyring.json")
  const file = readKeyringFile(path)

  const code = await promptHidden("リカバリコードを入力: ")
  let dek: Buffer
  try {
    dek = unwrapDek(file.recovery.wrappedDek, code, Buffer.from(file.recovery.salt, "base64url"))
  } catch {
    console.error("リカバリコードが正しくありません。")
    process.exit(1)
  }
  if (!verifyDekCheck(dek, file.dekCheck)) {
    console.error("鍵の検証に失敗しました。")
    process.exit(1)
  }

  const new1 = await promptHidden("新しい運用パスフレーズ: ")
  if (new1.length < 12) {
    console.error("パスフレーズは12文字以上にしてください。")
    process.exit(1)
  }
  const new2 = await promptHidden("新しい運用パスフレーズ(確認): ")
  if (new1 !== new2) {
    console.error("パスフレーズが一致しません。")
    process.exit(1)
  }

  const newSalt = randomBytes(16)
  file.op = {
    salt: newSalt.toString("base64url"),
    wrappedDek: wrapDek(dek, new1, newSalt),
  }
  dek.fill(0)
  writeKeyringFile(path, file)

  console.log("✅ 運用パスフレーズを再設定しました（DEK は不変・データ再暗号化は不要）。")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
