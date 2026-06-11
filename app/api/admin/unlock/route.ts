import { NextRequest, NextResponse } from "next/server"
import { unlock, verifyUnlockToken } from "@/lib/crypto/keyring"

export const runtime = "nodejs"

// 失敗試行のレート制限（メモリ内）。15分で5回まで、超過は要サーバ再起動。
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
let failures: number[] = []

export async function POST(request: NextRequest) {
  const now = Date.now()
  failures = failures.filter((t) => now - t < WINDOW_MS)
  if (failures.length >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: "試行回数の上限に達しました。サーバーを再起動してください。" },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON ボディが必要です" }, { status: 400 })
  }

  const { token, passphrase } = (body ?? {}) as { token?: unknown; passphrase?: unknown }
  if (typeof token !== "string" || typeof passphrase !== "string") {
    return NextResponse.json({ error: "token と passphrase が必要です" }, { status: 400 })
  }

  if (!verifyUnlockToken(token)) {
    failures.push(now)
    return NextResponse.json({ error: "トークンが無効です" }, { status: 401 })
  }

  try {
    unlock(passphrase)
  } catch {
    failures.push(now)
    return NextResponse.json({ error: "アンロックに失敗しました" }, { status: 401 })
  }

  // 成功したら失敗カウントをリセット（攻撃者は成功しないので安全・操作者UXのみ改善）
  failures = []
  return NextResponse.json({ state: "ready" })
}
