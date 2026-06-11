# P1 実装スペック: 自由記述列の暗号化（Prisma Client Extension 検証）

**文書種別**: 実装スペック（backlog-ready）
**フェーズ**: P1（Tier3 自由記述の暗号化）
**前提**: P0（暗号コア + sealed/unlock）が main にマージ済み（v0.3.11.14）。鍵エスクロー承認済み。
**関連設計**: `docs/plans/app-level-encryption-design.md`（§4 Tier3・§5 Prisma統合・§7 移行・§13 テスト）／`docs/plans/app-level-encryption-p0-spec.md`
**作成日**: 2026-06-11
**ステータス**: 確定

---

## Context

P0 で構築した keyring（DEK をメモリのみ保持）を使い、**初めて実データ列を暗号化**する。P1 の目的は **Prisma Client Extension による透過暗号化をエンドツーエンドで検証する低リスク段階**。検索/ソート対象でない自由記述列のみを対象とし、クエリ層のリファクタは発生させない。

## スコープ（確定）

通常の Prisma create/update で書き込まれる**4列**を暗号化:

| 列 | 現在の型 | 対応 |
|---|---|---|
| `DutyAssignment.note` | `@db.Text` | そのまま暗号化（幅OK） |
| `DutyAssignment.title` | `@db.VarChar(100)` | **`@db.Text` へ拡張**してから暗号化 |
| `DutyType.defaultNote` | `@db.Text` | そのまま暗号化 |
| `DutyType.defaultTitle` | `@db.VarChar(100)` | **`@db.Text` へ拡張**してから暗号化 |

## Out of Scope（P1では絶対やらない）

- 🔴 **`shift_change_history.note`（@db.VarChar(255)）**: DBトリガーが `set_config('app.shift_note', ...)` から書き込むため **Prisma Client Extension では捕捉できない**。暗号化するには `lib/actions/shift-actions.ts` で set_config 前に暗号化 + 履歴表示側で復号、という別経路の改修が必要 → **P1.5 として分離**。
- Tier1（氏名/フリガナ）と検索/ソート/ページングのアプリ層リファクタ → P2。
- バックフィル以外のスキーマ変更。

## Proposed Change

### 1. Prisma Client Extension（透過暗号化）

`lib/crypto/prisma-encryption.ts`（新規）に**再利用可能な拡張ファクトリ**を実装し、本番クライアントとテストクライアントの両方に適用する。

```
ENCRYPTED_FIELDS（レジストリ）:
  DutyAssignment: ["note", "title"]
  DutyType:       ["defaultNote", "defaultTitle"]

withEncryption(client) = client.$extends({
  query:  create/update/upsert/createMany で対象フィールドを書き込み前に keyring.encrypt()
  result: 読み取り結果の対象フィールドを keyring.decrypt()
})
```

- 適用先: `lib/prisma.ts`（本番シングルトン）と `tests/helpers/prisma.ts`（テスト）。同じファクトリを通すことで挙動を一致させる。
- 暗号化は P0 の `lib/crypto/keyring.ts` の `encrypt()/decrypt()` を使用（`v1:` 形式）。
- **値が `null`/`undefined` の場合はそのまま**（暗号化しない）。
- **既存の `v1:` 接頭辞付き値は二重暗号化しない**（write 時に判定）。read 時は接頭辞が無ければ平文として返す（移行ウィンドウ対応）。

### 2. sealed 時のハンドリング（P0 で defer した sealed ゲートが必須化）

暗号化列を sealed 中に読むと `result` 拡張内の `decrypt()` が **`KeyringSealedError` を throw** し、当該クエリが失敗する（フェイルクローズ契約は維持）。これを 500 にせず UX を保つため:

- 暗号化列を読む**ページ（duty-assignments / duty-types）の Server Component / Server Action は `KeyringSealedError` を捕捉**し、「🔒 ロック中 — 管理者のアンロックが必要です」を表示する。
- 共通の sealed バナー（`/api/admin/lock-status` を参照）を `(main)` レイアウトに追加。
- 書き込みは sealed 中は throw のまま（PII を平文で書かせない）。

### 3. スキーマ移行

- `DutyAssignment.title` と `DutyType.defaultTitle` を **`@db.VarChar(100)` → `@db.Text`** に変更する Prisma migration。
- `npx prisma migrate dev` で生成。`docs/shift_database_schema_v9.md` を更新。

### 4. バックフィル

`scripts/backfill-encrypt-tier3.ts`（新規・tsx・要アンロック）:
1. 列拡張（migration）適用後に実行。
2. 対象4列の既存行を取得 → 先頭が `v1:` でなければ暗号化して update（**冪等**）。
3. クラッシュ後の再実行で `v1:` 行はスキップ。

### 5. テストインフラ

- `.env.test` に `KEYRING_TEST_PASSPHRASE` を追加。
- `tests/setup.ts` で**起動時に1回**: テスト用 keyring.json（一時パス）を生成 → `keyring.unlock(KEYRING_TEST_PASSPHRASE)`。拡張は `tests/helpers/prisma.ts` にも適用済みなので、統合テスト・サーバーアクションテストとも透過暗号化が効く。

## Acceptance Criteria

1. DutyAssignment を note/title 付きで作成 → **生SQLで `v1:` 暗号文**を確認 → Prisma 経由で読むと平文。
2. DutyType の defaultNote/defaultTitle も同様にラウンドトリップ。
3. `null` の note/title は暗号化されず `null` のまま。
4. 既存 `v1:` 値は再 update で二重暗号化されない。
5. CSV エクスポート（duty-assignments）は復号後の平文がセルに入り、`rowsToCsv` の数式中和も従来どおり効く。
6. **sealed 中**に duty-assignments ページを開くと 500 ではなく「🔒 ロック中」表示。書き込みは失敗する。
7. バックフィルは冪等（2回実行で二重暗号化なし・途中失敗から再開可）。
8. `title` 列が `Text` になり、100文字超の暗号文が切り詰められない。
9. lint・tsc・テストすべてグリーン。

## Testing Plan

| Layer | What | Count |
|---|---|---|
| 統合(要DB) | DutyAssignment note/title 暗号往復・生SQLで暗号文確認・null 非暗号化・二重暗号化なし | +4 |
| 統合(要DB) | DutyType defaults 暗号往復 | +2 |
| 統合(要DB) | duty-assignments export が復号値を出力 | +1 |
| ユニット | 拡張ファクトリ: 対象フィールド判定・`v1:` 既存値スキップ・null スルー | +3 |
| ユニット | sealed 時に対象ページの取得が KeyringSealedError を投げる（拡張経由） | +1 |
| バックフィル | 冪等・再開 | +2 |

## Files Reference

| File | Change |
|---|---|
| `lib/crypto/prisma-encryption.ts` | 新規: `withEncryption()` 拡張ファクトリ + `ENCRYPTED_FIELDS` レジストリ |
| `lib/prisma.ts` | シングルトンに `withEncryption()` を適用 |
| `tests/helpers/prisma.ts` | テストクライアントに `withEncryption()` を適用 |
| `prisma/schema.prisma` | `DutyAssignment.title` / `DutyType.defaultTitle` を `@db.Text` に |
| `prisma/migrations/*` | 上記列の型変更 migration |
| `app/(main)/duty-assignments/**` `app/(main)/duty-types/**` | sealed 時の「🔒 ロック中」ハンドリング |
| `app/(main)/layout.tsx` | sealed バナー（lock-status 参照） |
| `scripts/backfill-encrypt-tier3.ts` | 新規: 冪等バックフィル（tsx） |
| `tests/crypto/prisma-encryption.test.ts` ほか | 新規テスト |
| `.env.test` / `tests/setup.ts` | テスト用 keyring アンロック |
| `docs/shift_database_schema_v9.md` | 列型変更を反映 |

## Effort Estimate

- 拡張ファクトリ + 適用: ~3h / sealed ページハンドリング + バナー: ~3h / migration + バックフィル: ~2h / テストインフラ + テスト13本: ~4h。**計 ~12h（CC: ~1.5日）**。

## Rollback Plan

- 拡張適用前なら新規ファイル削除で戻る。
- バックフィル後のロールバックは、アンロック状態で「復号して平文に戻す」逆バックフィルが必要（`v1:` 値を decrypt して update）。migration（Text化）は後方互換なのでそのままでよい。
- 段階リリース: 拡張 + sealed ハンドリングを先にリリース（新規書き込みのみ暗号化）→ 別PRでバックフィル、という分割も可能。

## 次フェーズ（参考・本スペック対象外）

- **P1.5**: `shift_change_history.note` の暗号化（`shift-actions.ts` の set_config 前で暗号化 + 履歴表示で復号）。
- **P2**: Tier1（氏名/フリガナ）。列幅 ALTER + リポジトリ層で検索/ソート/ページングをアプリ化 + 冪等バックフィル。
