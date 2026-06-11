import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildKeyringFile,
  generateRecoveryCode,
  randomDek,
  writeKeyringFile,
} from "@/lib/crypto/envelope"

const OP_FIXTURE = "operational-test-input-123"
let dir: string

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/admin/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function loadRoutes() {
  const unlockRoute = await import("@/app/api/admin/unlock/route")
  const statusRoute = await import("@/app/api/admin/lock-status/route")
  return { unlockRoute, statusRoute }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "keyring-route-"))
  const path = join(dir, "keyring.json")
  writeKeyringFile(path, buildKeyringFile(randomDek(), OP_FIXTURE, generateRecoveryCode()))
  process.env.KEYRING_PATH = path
  process.env.UNLOCK_TOKEN_PATH = join(dir, "unlock.token")
  // モジュール状態（keyring シングルトン・レート制限）をテスト毎にリセット
  vi.resetModules()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  delete process.env.KEYRING_PATH
  delete process.env.UNLOCK_TOKEN_PATH
})

describe("unlock route", () => {
  it("トークン不一致は 401", async () => {
    const { statusRoute, unlockRoute } = await loadRoutes()
    await statusRoute.GET() // token ファイルを materialize
    const res = await unlockRoute.POST(
      makeReq({ token: "bad-token", passphrase: OP_FIXTURE }) as Parameters<typeof unlockRoute.POST>[0],
    )
    expect(res.status).toBe(401)
  })

  it("正しい token + パスフレーズで ready に遷移する", async () => {
    const { statusRoute, unlockRoute } = await loadRoutes()
    await statusRoute.GET()
    const token = readFileSync(process.env.UNLOCK_TOKEN_PATH as string, "utf8").trim()

    const before = await statusRoute.GET()
    expect((await before.json()).state).toBe("sealed")

    const res = await unlockRoute.POST(
      makeReq({ token, passphrase: OP_FIXTURE }) as Parameters<typeof unlockRoute.POST>[0],
    )
    expect(res.status).toBe(200)

    const after = await statusRoute.GET()
    expect((await after.json()).state).toBe("ready")
  })

  it("5回失敗するとレート制限で 429", async () => {
    const { statusRoute, unlockRoute } = await loadRoutes()
    await statusRoute.GET()
    for (let i = 0; i < 5; i++) {
      const r = await unlockRoute.POST(
        makeReq({ token: "bad", passphrase: "x" }) as Parameters<typeof unlockRoute.POST>[0],
      )
      expect(r.status).toBe(401)
    }
    const r6 = await unlockRoute.POST(
      makeReq({ token: "bad", passphrase: "x" }) as Parameters<typeof unlockRoute.POST>[0],
    )
    expect(r6.status).toBe(429)
  })

  it("成功アンロックで失敗カウントがリセットされる", async () => {
    const { statusRoute, unlockRoute } = await loadRoutes()
    await statusRoute.GET()
    const token = readFileSync(process.env.UNLOCK_TOKEN_PATH as string, "utf8").trim()

    for (let i = 0; i < 4; i++) {
      const r = await unlockRoute.POST(
        makeReq({ token: "bad", passphrase: "x" }) as Parameters<typeof unlockRoute.POST>[0],
      )
      expect(r.status).toBe(401)
    }
    // 成功でリセット
    const ok = await unlockRoute.POST(
      makeReq({ token, passphrase: OP_FIXTURE }) as Parameters<typeof unlockRoute.POST>[0],
    )
    expect(ok.status).toBe(200)
    // さらに4回失敗しても 429 にならない（カウントがリセット済み）
    for (let i = 0; i < 4; i++) {
      const r = await unlockRoute.POST(
        makeReq({ token: "bad", passphrase: "x" }) as Parameters<typeof unlockRoute.POST>[0],
      )
      expect(r.status).toBe(401)
    }
  })
})
