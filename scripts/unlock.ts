// 毎回の起動後アンロック（運用者がサーバー上で実行）。
//   1) lock-status を ping（サーバ疎通確認 + token ファイル materialize）
//   2) secrets/unlock.token を読む（同一マシンでの実行が前提）
//   3) 運用パスフレーズを no-echo 入力
//   4) loopback の unlock エンドポイントへ {token, passphrase} を POST
//
// パスフレーズはサーバ側で scrypt + ラップ解除される。CLI は転送するだけ。
//
// 実行: npm run keyring:unlock

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { promptHidden } from "./lib/prompt"

async function main() {
  const port = process.env.PORT ?? "3000"
  const base = process.env.UNLOCK_BASE_URL ?? `http://127.0.0.1:${port}`
  const tokenFile = resolve(process.cwd(), process.env.UNLOCK_TOKEN_PATH ?? "secrets/unlock.token")

  // 1) status ping
  let statusRes: Response
  try {
    statusRes = await fetch(`${base}/api/admin/lock-status`)
  } catch {
    console.error(`サーバーに接続できません: ${base}`)
    console.error("アプリが起動しているか、PORT/UNLOCK_BASE_URL を確認してください。")
    process.exit(1)
  }
  const status = (await statusRes.json()) as { state?: string }
  if (status.state === "ready") {
    console.log("既に ready です。")
    return
  }

  // 2) token
  let token: string
  try {
    token = readFileSync(tokenFile, "utf8").trim()
  } catch {
    console.error(`unlock token が読めません: ${tokenFile}`)
    process.exit(1)
  }

  // 3) passphrase
  const passphrase = await promptHidden("運用パスフレーズを入力: ")

  // 4) POST
  const res = await fetch(`${base}/api/admin/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, passphrase }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.ok) {
    console.log("✅ ready")
  } else {
    console.error(`アンロック失敗 (${res.status}): ${data.error ?? ""}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
