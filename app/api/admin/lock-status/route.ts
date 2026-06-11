import { NextResponse } from "next/server"
import { getOrCreateUnlockToken, isUnlocked } from "@/lib/crypto/keyring"

export const runtime = "nodejs"

// keyring の状態を返す。同時に unlock token ファイルを生成（ローカル CLI が読むため）。
export async function GET() {
  getOrCreateUnlockToken()
  return NextResponse.json({ state: isUnlocked() ? "ready" : "sealed" })
}
