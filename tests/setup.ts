import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  buildKeyringFile,
  generateRecoveryCode,
  randomDek,
  writeKeyringFile,
} from "@/lib/crypto/envelope"
import * as keyring from "@/lib/crypto/keyring"
import { prisma } from "./helpers/prisma"

// テスト用 keyring。透過暗号化拡張（tests/helpers/prisma.ts）を効かせるため、
// 各テストファイルの起動時に DEK をメモリへ載せる（unlock）。
// keyring.json は固定の一時パスに1回だけ生成して再利用し、scrypt コストを抑える。
const TEST_PASSPHRASE =
  process.env.KEYRING_TEST_PASSPHRASE ?? "test-keyring-passphrase-0123456789"
const TEST_KEYRING_PATH = join(tmpdir(), "shift-app-test-keyring.json")

beforeAll(async () => {
  if (!existsSync(TEST_KEYRING_PATH)) {
    writeKeyringFile(
      TEST_KEYRING_PATH,
      buildKeyringFile(randomDek(), TEST_PASSPHRASE, generateRecoveryCode()),
    )
  }
  process.env.KEYRING_PATH = TEST_KEYRING_PATH
  if (!keyring.isUnlocked()) keyring.unlock(TEST_PASSPHRASE)
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})
