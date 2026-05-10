# シフトコード CSV インポート/エクスポート: デフォルト時刻・昼休憩対応

## 目的

シフトコード（`ShiftCode`）の CSV インポート/エクスポートに**昼休憩（開始・終了）列を追加**し、既存の開始・終了時刻と合わせて4つの時刻フィールドを CSV 経由で一括管理できるようにする。

## 背景・現状

### DB / フォーム側（実装済み）
Prisma `ShiftCode` モデルには既に以下のカラムが存在:
- `defaultStartTime` (`@db.Time(6)`)
- `defaultEndTime` (`@db.Time(6)`)
- `defaultLunchBreakStart` (`@db.Time(6)`)
- `defaultLunchBreakEnd` (`@db.Time(6)`)

`components/shift-codes/shift-code-form.tsx` のシングル編集フォームでは4つすべて入力可。`createShiftCode` / `updateShiftCode` Server Action も4つすべて永続化する。

### CSV 側（未対応 = 本プランの対象）
| 箇所 | 開始/終了時刻 | 昼休憩 |
|------|---------------|--------|
| `app/api/shift-codes/export/route.ts` | ✓ | ✗ |
| `lib/csv/parse-shift-code-csv.ts` `HEADER_MAP` | ✓ | ✗ |
| `lib/validators.ts` `shiftCodeCsvRowSchema` | ✓ | ✗ |
| `lib/actions/shift-code-actions.ts` `importShiftCodes` (`ShiftCodeImportRow`) | ✓ | ✗ |
| `components/shift-codes/shift-code-import-dialog.tsx` (説明文・プレビュー) | ✓ | ✗ |

### 関連参照
- `app/api/duty-types/export/route.ts` は「デフォルト開始時刻」と "デフォルト" プレフィックス付きヘッダーを使用（命名揺れあり、本プランでは既存命名を維持して破壊的変更を避ける）
- `tests/triggers/shift-code-defaults-trigger.test.ts` — トリガーで shifts への default 反映が既に存在

## スコープ

### IN
1. **CSV エクスポート** に「昼休憩開始」「昼休憩終了」列を追加（末尾追加）
2. **CSV インポート** で「昼休憩開始」「昼休憩終了」列を読み取り
3. **Validator** (`shiftCodeCsvRowSchema`) に2フィールド追加（`HH:mm` 形式または null）
4. **Server Action** (`importShiftCodes` / `ShiftCodeImportRow`) に2フィールド追加
5. **CSV パーサー** (`parseShiftCodeCsv`) で新規列の抽出と検証
6. **インポートダイアログ UI** の説明文とプレビュー表示更新（9列に拡張）
7. **テスト追加**: 新規列のパース成功・失敗パターン、インポート結果

### NOT IN（明示的に除外）
- ヘッダー命名統一（「開始時刻」→「デフォルト開始時刻」）: 既存 CSV との互換性を壊すため別 PR
- Excel (`parse-shift-xlsx.ts`) 経由のシフトコード入出力: 現状シフトコードは Excel フローに含まれない
- フォーム側の改修: 既に対応済み
- `defaultLunchBreakStart` のみ・`defaultLunchBreakEnd` のみ片側のみ入力時の整合性チェック: 単独でも入力可とし、業務側で運用判断（既存フォームと同じ仕様）
- **インポート実行前の確認 AlertDialog**: 全 CSV インポート（従業員/グループ/業務種別等）共通の UX 改善として TODOS.md に登録、別 PR 対応。本 PR ではサマリーバナー＋互換バナー＋件数表示でリスク軽減を図る

## 実装プラン

### Phase 1: 型・バリデーション層
1. `lib/validators.ts`
   - `shiftCodeCsvRowSchema` に `defaultLunchBreakStart: z.string().nullable()` と `defaultLunchBreakEnd: z.string().nullable()` を追加（既存 `defaultStartTime`/`defaultEndTime` と同じパターン: regex なしの nullable string、parser 側 `validateTime` で形式検証）
   - **NOTE:** フォーム用 `shiftCodeSchema` は `timeHHmmField`（regex 内蔵）を使用するが、CSV 用は parser が事前に形式不正行を除外する設計のため二重検証は不要
   - `ShiftCodeCsvRow` 型は `z.infer` 経由で自動更新

### Phase 2: パーサー
2. `lib/csv/parse-shift-code-csv.ts`
   - `HEADER_MAP` に `"昼休憩開始": "defaultLunchBreakStart"`, `"昼休憩終了": "defaultLunchBreakEnd"` 追加
   - `data` オブジェクトに2フィールド追加 (`validateTime` で `HH:mm` 検証、空欄→null)
   - 時刻形式エラーメッセージを2フィールド分追加（"昼休憩開始の形式が不正です（HH:mm）"等）
   - **`ShiftCodeCsvParseResult` 型に `lunchBreakColumnsMissing: boolean` を追加**:
     ```ts
     export type ShiftCodeCsvParseResult = {
       rows: ParsedShiftCodeRow[]
       headerValid: boolean
       headerError?: string
       lunchBreakColumnsMissing: boolean  // 新規
     }
     ```
   - 判定ロジック: `headerIndexMap.defaultLunchBreakStart === undefined && headerIndexMap.defaultLunchBreakEnd === undefined` で true（両方欠損のみ警告対象、片方だけ存在は許容）
   - `headerValid: false` の早期 return 経路でも明示的に `lunchBreakColumnsMissing: false` を含めること（型完全性）

### Phase 3: Server Action
3. `lib/actions/shift-code-actions.ts`
   - `ShiftCodeImportRow` 型に `defaultLunchBreakStart: string | null`, `defaultLunchBreakEnd: string | null` 追加
   - 関数シグネチャに `lunchBreakColumnsMissing: boolean` 引数を追加: `importShiftCodes(rows: ShiftCodeImportRow[], lunchBreakColumnsMissing: boolean)`
   - **昼休憩列欠損時の上書き保護（決定済み）**:
     ```ts
     // 既存挙動 + 昼休憩条件付き付与
     const data: Prisma.ShiftCodeUpdateInput = {
       color: row.color,
       defaultStartTime: toTimeOrNull(row.defaultStartTime),
       defaultEndTime: toTimeOrNull(row.defaultEndTime),
       defaultIsHoliday: row.defaultIsHoliday,
       isActive: row.isActive,
       sortOrder: row.sortOrder,
     }
     if (!lunchBreakColumnsMissing) {
       data.defaultLunchBreakStart = toTimeOrNull(row.defaultLunchBreakStart)
       data.defaultLunchBreakEnd = toTimeOrNull(row.defaultLunchBreakEnd)
     }
     ```
   - **新規作成 (`tx.shiftCode.create`) は常に4時刻全フィールドを書く** (新規レコードに既存値はないため): `lunchBreakColumnsMissing=true` の場合、null/undefined のまま書き込み（schema default で null 扱い）
   - import-dialog から呼び出す箇所も対応 (`importShiftCodes(rows, lunchBreakColumnsMissing)`)

### Phase 4: エクスポート API
4. `app/api/shift-codes/export/route.ts`
   - `headers` 末尾に `"昼休憩開始", "昼休憩終了"` 追加
   - `rows` map に `formatTime(sc.defaultLunchBreakStart)`, `formatTime(sc.defaultLunchBreakEnd)` 追加

### Phase 5: インポートダイアログ UI
5. `components/shift-codes/shift-code-import-dialog.tsx`
   - 説明文（CSV形式）に「昼休憩開始, 昼休憩終了」追加
   - **共通 `CsvPreviewTable` の既存サマリー（`全N件 / 有効: N件 / エラー: N件`）を活用**:
     - すでに件数表示があるため、新規サマリーバナーは追加しない（重複回避）
     - 既存の `<p>有効な{validCount}件のみインポートします</p>` は冗長なので削除
   - **昼休憩列欠損 info バナーは追加** (preview ステップ、`CsvPreviewTable` の**直上**):
     - `lib/csv/parse-shift-code-csv.ts` から `lunchBreakColumnsMissing: boolean` を返却
     - 形式: `[Info icon] 昼休憩列が見つかりません。全行の昼休憩は null として処理されます。`
     - アイコンは `lucide-react` の `Info`
     - 配色: `bg-muted text-muted-foreground` ＋ `rounded-md p-3`（shadcn セマンティックトークン）
     - エラー詳細リストは共通コンポーネントが既に表示するため、独自追加なし
   - `previewHeaders` に2列追加
   - `previewRows.cells` に2セル追加（null時は空欄表示）
   - `handleImport` の `rows.map` に2フィールド追加
   - **ダイアログ幅: `max-w-3xl` に拡張**（既存 `max-w-2xl`=672px から 768px へ）
     - 9列＋行番号＋valid アイコン = 計11列の現実的な可読幅を確保
     - 既存 `CsvPreviewTable` の `overflow-auto` は維持（モバイル用フォールバック）
     - モバイル (<640px) ではダイアログ自体が画面 95% 幅にレスポンシブ縮小（shadcn Dialog 既存挙動）→ 横スクロール発生は許容（業務系の運用はデスクトップ前提）
   - **a11y 改善**:
     - 昼休憩列欠損 info バナーに `role="status"` を付与（スクリーンリーダーに通知）
     - info バナーの `Info` アイコンに `aria-hidden="true"`（テキストで意味伝達のため）

#### Preview ステップの情報階層（決定済み）
| 優先順 | 要素 | 役割 |
|--------|------|------|
| 1 | 昼休憩列欠損 info バナー（該当時のみ） | 旧フォーマット警告（破壊的操作の前提情報） |
| 2 | `CsvPreviewTable`（既存：件数サマリー＋テーブル＋エラー詳細） | 件数把握 → 個別行の中身確認 |
| 3 | アクション（再選択 / 実行） | 確定アクション |

#### インタラクション状態（決定済み）
| 機能 | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|------|---------|-------|-------|---------|---------|
| ファイル選択 | – | – | `headerError` 赤文字表示 | preview へ遷移 | – |
| CSV パース | （同期処理・通常一瞬。1MB超想定なし） | **データ行0件時: select ステップに留まり「データ行が見つかりません」エラー表示** | ヘッダー不正/必須欠落: `headerError` | – | – |
| プレビューテーブル | – | **全行エラー時: テーブル表示するがバナーは `⚠ N件 全てエラー` 強調、実行ボタン disabled（既存挙動維持）** | 行を `bg-destructive/5` 等で淡くハイライト | – | – |
| インポート実行 | "インポート中..." | – | `toast.error` + result ステップで詳細 | `toast.success` | result ステップで created/updated/errors 個別表示 |

#### 時刻セルの値表示ルール（4列共通: 開始/終了/昼休憩開始/昼休憩終了）
- **null**: `—` (em-dash, U+2014) を `text-muted-foreground` で表示
- **正常値**: `HH:mm` 形式そのまま（例: `09:00`）
- **不正値**: バリデーションでエラー行になるため、行ごと `error` メッセージで表示（セル単体の特別扱いはしない）
- CSV エクスポート側は **空文字** のまま（互換性維持。ダッシュは表示層のみ）

#### 後方互換 CSV（昼休憩列なし）の扱い（決定済み）
- `parseShiftCodeCsv` でヘッダー検出時に `defaultLunchBreakStart` / `defaultLunchBreakEnd` の存在をチェック
- **両方欠損時のみ** `lunchBreakColumnsMissing: true`（片方のみ存在は許容、片方は null として処理）
- preview ステップ上部（サマリーバナーの**下**、テーブルの**上**）に info トーンのバナーを表示:
  ```
  ℹ 昼休憩列が見つかりません。既存シフトコードの昼休憩は変更されません。
  ```
  （**「変更されません」と明記** ─ 上書き保護の決定を反映）
- 配色: `bg-muted` + `text-muted-foreground`（既存セマンティックトークン）
- 全行エラーバナー（warning）と同時表示時は warning が上、info が下
- **データ保護挙動**: `importShiftCodes` は `lunchBreakColumnsMissing=true` のとき、UPDATE 文の `data` から昼休憩フィールドを除外。既存レコードの昼休憩値は保持される。新規作成時のみ null として書き込み（既存値がないため）

### Phase 6: テスト

**6.1. 新規ファイル: `tests/validators/parse-shift-code-csv.test.ts`** (現在不在)

`parseShiftCodeCsv` のユニットテスト。helper モック不要（純関数）。以下を網羅:

| # | テストケース | アサート |
|---|------------|---------|
| 1 | 9列CSV (昼休憩込み) 全列 valid | `headerValid=true`, `lunchBreakColumnsMissing=false`, 各 row.data に値 |
| 2 | 9列CSV 昼休憩値が空欄 | `defaultLunchBreakStart/End === null`, valid=true |
| 3 | 9列CSV 昼休憩形式不正 (`25:99`) | row.valid=false, error メッセージに「昼休憩開始の形式が不正です（HH:mm）」 |
| 4 | **[CRITICAL REGRESSION]** 7列CSV (昼休憩なし、旧形式) | `headerValid=true`, `lunchBreakColumnsMissing=true`, rows パース成功 |
| 5 | 8列CSV (昼休憩開始のみ) | `lunchBreakColumnsMissing=false`, `defaultLunchBreakEnd=null` |
| 6 | 8列CSV (昼休憩終了のみ) | `lunchBreakColumnsMissing=false`, `defaultLunchBreakStart=null` |
| 7 | CSV 空 → headerError "CSVが空です" | `headerValid=false`, `lunchBreakColumnsMissing=false` |
| 8 | 必須ヘッダー (`シフトコード`) 欠損 | `headerValid=false`, headerError 表示 |

**6.2. 新規ファイル: `tests/actions/import-shift-codes.test.ts`** (現在不在 ─ パターンは `tests/actions/import-employees.test.ts` 参考)

`importShiftCodes` のテスト。`mockNextCache()`, `mockAuth()`, prisma helper mock 必須:

| # | テストケース | アサート |
|---|------------|---------|
| 1 | 新規作成: 昼休憩値 ("12:00"/"13:00") | DB に 4 時刻全部永続化 (`defaultLunchBreakStart` Date) |
| 2 | 既存更新: 昼休憩値あり | 既存レコード上書き、4時刻全フィールド更新 |
| 3 | 昼休憩 null (空欄) で新規作成 | DB の昼休憩カラム null |
| 4 | **[CRITICAL REGRESSION]** `lunchBreakColumnsMissing=true` で既存レコード更新 | 既存の `defaultLunchBreakStart/End` 値は**保持**される（color, isActive 等は上書き） |
| 5 | `lunchBreakColumnsMissing=true` で新規作成 | 昼休憩カラムは null |
| 6 | 認証なし (`auth` mock を null) | 既存パターンの error または throw |

**6.3. 既存ファイル更新: `tests/actions/shift-code-actions.test.ts`**

`createShiftCode`/`updateShiftCode` で昼休憩フィールドが正しく永続化されることを確認するケースを追加（form 経路の昼休憩は既に実装済みだが、リグレッション防止のため）。

**6.4. 新規 (任意): `tests/api/shift-codes-export.test.ts`**

CSV エクスポート route の出力検証は既存パターンに沿う場合のみ追加（`tests/db/role-assignments-export.test.ts` 参考）。優先度低、PR スコープ内で時間があれば。

**E2E は不要**: ラウンドトリップ（export → import）は単体テストで `parseShiftCodeCsv(formatToCsv(data))` の往復で検証可能。`/qa` マニュアルテストでブラウザ動作確認すれば十分（既存 CSV インポートも E2E カバーなし）。

## 受け入れ条件

1. 既存の昼休憩データを持つシフトコードをエクスポート → CSV に4列の時刻が出力される
2. 昼休憩列を含む CSV をインポート → DB の昼休憩カラムが更新される
3. **後方互換**: 昼休憩列を含まない既存 CSV をインポート → エラーにならず、昼休憩は null のまま
4. 不正な時刻形式（`25:99`等）はプレビューでエラー表示、インポート実行から除外
5. 全テスト pass、`npm run lint` clean

## リスク・検討事項

- **後方互換性**: 必須ヘッダーは `シフトコード` のみ。昼休憩列は optional 扱いで既存 CSV をそのまま読める
- **UI 横幅**: ダイアログ `max-w-2xl` で9列のプレビューが収まるか実測（必要なら `min-w-0` 配下で横スクロール）
- **空文字 vs null**: 既存パターン踏襲（`""` → null）

## UI スコープ

**変更箇所:**
- `shift-code-import-dialog.tsx`
  - CSV 形式説明文（テキスト変更: 9列に拡張）
  - 昼休憩列欠損 info バナー追加（preview ステップ、テーブル直上）
  - プレビューテーブル（列追加 → ダイアログ幅 `max-w-3xl` に拡張）
  - エラーメッセージ表示（昼休憩の時刻形式不正時）
  - `<p>有効な{validCount}件のみインポートします</p>` 削除（`CsvPreviewTable` の既存サマリーで代替）

**変更なし:**
- `shift-code-export-button.tsx`（ボタン UI 自体は不変、ダウンロード CSV 内容のみ変更）
- `shift-code-form.tsx`（既に4時刻対応済み）
- `shift-code-table.tsx` / `shift-code-columns.tsx`（一覧表示は別議論、本 PR 対象外）
- `components/csv-import/csv-preview-table.tsx`（共通コンポーネント、本 PR 対象外。トークン化は TODOS.md 登録済み）

## 既存資産の再利用

| 資産 | 再利用方針 |
|------|-----------|
| `components/csv-import/csv-preview-table.tsx` | サマリー表示・行ハイライト・エラー詳細を全て活用、追加実装なし |
| `components/csv-import/csv-file-input.tsx` | そのまま流用 |
| shadcn `Dialog`, `Table`, `Button`, `AlertDialog` | 全て既存利用パターンに従う |
| `lucide-react` の `Info`, `CheckCircle2`, `AlertTriangle` | 既存 CSV プレビューと同じアイコンセット |
| Prisma `ShiftCode.defaultLunchBreak{Start,End}` カラム | 既存 schema、追加マイグレーション不要 |
| `lib/validators.ts` `timeHHmmField` | 昼休憩時刻バリデーションに再利用 |

## デザインレビュー結果サマリー (2026-05-10)

| Pass | 評価 | 主な決定 |
|------|------|----------|
| 1. Information Architecture | 4 → 8 | preview 階層を info バナー > テーブル > アクションで定義（共通コンポーネント既存サマリー活用） |
| 2. Interaction State Coverage | 4 → 9 | null/正常/不正の表示ルール、後方互換 info バナー、データ0行/全行エラー時の挙動を明文化 |
| 3. User Journey & Emotional Arc | 6 → 8 | 確認 AlertDialog は別 PR (TODOS) へ。本 PR は件数表示＋互換バナーで軽減 |
| 4. AI Slop Risk | 9 → 10 | `lucide-react` アイコンとセマンティックトークンで規定 |
| 5. Design System Alignment | 6 → 8 | 共通 `CsvPreviewTable` 再利用、style-guide.md 整合（残課題は TODOS） |
| 6. Responsive & Accessibility | 4 → 8 | `max-w-3xl`、`role="status"`、`aria-hidden` を追加 |
| 7. Unresolved Decisions | – | 0 件残存 |

**全体スコア: 5 → 8.4 / 10**
