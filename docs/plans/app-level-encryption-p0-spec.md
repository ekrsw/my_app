# P0 実装スペック: 暗号コア + sealed/unlock 動線

**文書種別**: 実装スペック（backlog-ready）
**フェーズ**: P0（暗号化ロードマップの基盤）
**関連設計**: `docs/plans/app-level-encryption-design.md`（§2 鍵管理・§3 unlock・§12 エスクロー・§13 テスト）／`docs/plans/app-level-encryption-key-escrow-procedure.md`
**作成日**: 2026-06-11
**ステータス**: 確定（実装着手は鍵エスクロー承認が前提）

---

## Context

方式B（鍵をディスクに置かず、起動時パスフレーズでメモリのみ展開）でPII列を暗号化する計画の基盤フェーズ。P0 は**スキーマも実データも触らず**、暗号コアと sealed→unlock 動線をエンドツーエンドで確立・実証する。これが無いと P1（notes暗号化）以降に進めない。

## Out of Scope（P0では絶対やらない）

- Prisma スキーマ変更・列の拡張（VarChar→Text）
- 実データの暗号化・Prisma Client Extension・`lib/db/employees.ts` のリファクタ
- sealed バナー/UIゲート（暗号化列が無いP0では不要。P1で追加）
- バックフィル

## Proposed Change（新規ファイルのみ・既存コード非改変）

```
scripts/keyring-init.ts     ── 初期化(DEK生成 + 二重ラップ + リカバリコード表示)
scripts/keyring-recover.ts  ── リカバリ(リカバリコード → 新運用PF再ラップ)
scripts/unlock.ts           ── CLIアンロック(token + PF を loopback に POST)
        │
        ▼ (HTTP loopback IPC)
app/api/admin/unlock/route.ts       ── POST: token検証 → keyring.unlock(PF)
app/api/admin/lock-status/route.ts  ── GET: {state: sealed|ready}
        │
        ▼
lib/crypto/keyring.ts   ── メモリ内シングルトン: unlock/lock/encrypt/decrypt/isUnlocked
lib/crypto/envelope.ts  ── scrypt KDF・DEK wrap/unwrap・keyring.json I/O・AES-GCM
lib/crypto/errors.ts    ── KeyringSealedError / KeyringUnlockError
```

### 暗号仕様

- **暗号方式**: AES-256-GCM（`node:crypto`、新規依存ゼロ）。値の格納形式: `v1:<b64url(iv12)>.<b64url(tag16)>.<b64url(ct)>`。IVは値ごとにランダム12バイト。
- **KDF**: scrypt（`crypto.scryptSync`）、`N=2^17, r=8, p=1, keylen=32`、salt=16バイト乱数（keyring毎）。
- **DEK**: 32バイト乱数。`encrypt()/decrypt()` で使用、メモリのみ。
- **Envelope**: DEK を KEK(運用PF由来) と KEK(リカバリコード由来) で各々 AES-256-GCM ラップ（同 `v1:` 形式）。
- **リカバリコード**: 32バイト乱数を base64url 化（~43文字、依存ゼロ）。init で1回だけ表示。
- **dekCheck**: 既知平文 `"keyring-check-v1"` を DEK で暗号化して保存。unlock 時に復号一致で鍵検証（誤PFは GCM 認証失敗でも検出される二重確認）。

### `secrets/keyring.json` 形式

```json
{
  "version": 1,
  "kdf": "scrypt",
  "scrypt": { "N": 131072, "r": 8, "p": 1 },
  "op":       { "salt": "<b64url>", "wrappedDek": "v1:..." },
  "recovery": { "salt": "<b64url>", "wrappedDek": "v1:..." },
  "dekCheck": "v1:..."
}
```

- パス: リポジトリ直下 `secrets/keyring.json`。env `KEYRING_PATH` で上書き可（テストは一時パス）。
- **`.gitignore` に `secrets/` を追加**（誤コミット防止）。

### unlock エンドポイントの localhost 保証（Windows/Next 対応）

Next は LAN 配信のため 0.0.0.0 にバインドする＝IPだけでは loopback 限定にできない。そこで:

- サーバ起動時に**ランダム unlockToken をメモリ生成 → `secrets/unlock.token` に書き出し**（鍵素材ではないのでディスク可）。
- `scripts/unlock.ts` は同ファイルを読み（=同一マシンにFSアクセスが必要）、`{ token, passphrase }` を `http://127.0.0.1:<PORT>/api/admin/unlock` に POST。
- ルートは token を**定数時間比較**してから `keyring.unlock(passphrase)`。**レート制限: 15分で5回**、超過は要サーバ再起動。
- `export const runtime = "nodejs"`（`shift-conversion` ルートと同様）。keyring は **middleware/edge に import しない**。

## Acceptance Criteria

1. `npm run keyring:init` で DEK 生成・`keyring.json` 作成・リカバリコードを1回表示。**DEK 平文はディスクに書かれない**（`keyring.json` に平文DEKが無いことをテストで確認）。
2. アプリ起動直後は `GET /api/admin/lock-status` が `{"state":"sealed"}`。
3. `npm run keyring:unlock` で正しい運用PF入力 → status が `{"state":"ready"}`。
4. sealed 中に `keyring.encrypt()/decrypt()` を呼ぶと **`KeyringSealedError` を throw**（暗号文や null を返さない）。
5. unlock 後、`encrypt(x)` → `decrypt()` がラウンドトリップで `x` に一致。同一平文を2回暗号化すると**異なる暗号文**（IV乱数性）。改竄した暗号文/tagは復号時に throw。
6. 誤った運用PF → unlock 失敗、status は `sealed` のまま。レート制限超過で 429。
7. `keyring-recover.ts` でリカバリコード → 新運用PF再設定後、**旧PF失敗・新PF成功・既存 dekCheck 復号可**（DEK不変）。
8. unlock エンドポイントは token 不一致で 401。
9. lint・tsc・テストすべてグリーン。

## Testing Plan（§13準拠・すべて DB 不要ユニット）

| Layer | What | Count |
|---|---|---|
| Unit | envelope: encrypt/decrypt往復・GCM改竄検出・IV乱数性・`v1:`パース | +5 |
| Unit | keyring 状態機械: sealed→unlock(正)→ready / 誤PF→sealed / sealed中 encrypt・decrypt→throw | +4 |
| Unit | エスクロー: 両鍵から同一DEK / リカバリ後 旧PF失敗・新PF成功・DEK不変 | +3 |
| Unit | unlock route: token不一致→401 / レート制限→429（route ハンドラ単体テスト） | +2 |

テストは `tests/crypto/` に配置。DB不要なので `.env.test`・テストDB不要（既存の validators/utils テストと同じ無DBパターン）。

## Files Reference

| File | Change |
|---|---|
| `lib/crypto/envelope.ts` | 新規: scrypt・wrap/unwrap・AES-GCM・keyring.json I/O |
| `lib/crypto/keyring.ts` | 新規: メモリ内シングルトン |
| `lib/crypto/errors.ts` | 新規: 型付きエラー |
| `app/api/admin/unlock/route.ts` | 新規: POST(token+PF)、loopback token + レート制限、`runtime=nodejs` |
| `app/api/admin/lock-status/route.ts` | 新規: GET state |
| `scripts/keyring-init.ts` | 新規CLI（tsx実行） |
| `scripts/keyring-recover.ts` | 新規CLI |
| `scripts/unlock.ts` | 新規CLI |
| `package.json` | scripts 追加: `keyring:init` / `keyring:recover` / `keyring:unlock` |
| `.gitignore` | `secrets/` 追加 |
| `tests/crypto/envelope.test.ts` / `keyring.test.ts` / `escrow.test.ts` / `unlock-route.test.ts` | 新規ユニットテスト |

## Effort Estimate

- envelope + keyring + errors: ~3h
- unlock・status route + token: ~2h
- CLI 3本: ~2h
- テスト14本: ~3h
- **計 ~10h（CC: ~1日）**

## Rollback Plan

全て新規ファイル＋`package.json`/`.gitignore` の追記のみ。既存挙動はゼロ改変なので、PR revert で完全に戻る。`secrets/` は git 管理外。

## 🔴 実装着手の前提

**鍵エスクロー手順書の承認が未完**（`docs/plans/app-level-encryption-key-escrow-procedure.md`）。P0 のコードは書けるが、`keyring-init` で本番鍵を生成・運用に乗せるのは承認後。

## 次フェーズ（参考・本スペック対象外）

- **P1**: Tier3（自由記述notes）を暗号化。Prisma Client Extension をエンドツーエンド検証（クエリ影響ゼロ）。`tests/setup.ts` に `KEYRING_TEST_PASSPHRASE` での起動時アンロックを追加。
- **P2**: Tier1（氏名/フリガナ）。列幅 ALTER（VarChar→Text、履歴表含む）→ リポジトリ層で検索/ソート/ページングをアプリ化 → 冪等バックフィル。
