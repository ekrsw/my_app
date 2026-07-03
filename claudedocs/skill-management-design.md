# スキル管理機能 設計ドキュメント

**日付**: 2026-07-03
**モード**: office-hours（社内機能の設計セッション）
**ステータス**: 実装完了（型チェック・lint・全807テスト・本番ビルド 通過）。dev DB へのマイグレーション適用は要実行（下記）。

---

## 1. ゴール

社員に「スキル」を割り当て、レベル（習熟度）を管理する。
中核アイデアは **イベントソーシング（追記専用ログ）**:

- レベルが上がったら**新しい割当行を追記する**（過去の行は書き換えない）
- 各スキルについて**最新の割当行を見れば、その社員の現在のレベルが分かる**
- `end_date` は設けない。期間の概念を持たない

これにより「割当テーブルそのものが履歴」になり、既存の
`position`/`group`/`role` のような**別履歴テーブル＋DBトリガーが不要**になる。
既存の `duty_assignments`（追記専用の事実記録）と同じ思想。

---

## 2. 確定した設計判断

| # | 論点 | 決定 | 理由 |
|---|------|------|------|
| 1 | 訂正・取り消し | **物理DELETE（純・追記専用）** | 別履歴テーブルもトリガーも不要。最もシンプル。誤登録は行を消すだけ |
| 2 | レベルの型 | **整数レベル** | 追加マスタ不要。UIは数字/星で表現 |
| 3 | レベル上限 | **全スキル共通で 1〜5 固定** | `skills` マスタに `max_level` 不要。バリデーションは定数 `1..5` |
| 4 | 降格 | データ上は可能だが**運用上は想定外** | 「レベルアップ時に追記」が基本。降格を禁止するDB制約は張らない（柔軟性維持） |
| 5 | 実装アプローチ | **B: 最小構成 + 利便VIEW** | 現レベル算出ロジックをDBビュー1箇所に集約 |

---

## 3. スキーマ設計

### 3.1 マスタ: `skills`

`positions` テーブルとほぼ同型。既存のマスタCRUD・画面パターンをそのまま流用できる。

```prisma
model Skill {
  id        Int      @id @default(autoincrement())
  skillCode String   @unique @map("skill_code") @db.VarChar(20)
  skillName String   @map("skill_name") @db.VarChar(50)
  isActive  Boolean? @default(true) @map("is_active")
  sortOrder Int      @default(0) @map("sort_order")

  employeeSkills EmployeeSkill[]

  @@map("skills")
}
```

### 3.2 割当（＝履歴そのもの）: `employee_skills`

1行 = (社員, スキル, レベル, 付与日)。**このテーブル自体が時系列の履歴**。

```prisma
model EmployeeSkill {
  id         Int      @id @default(autoincrement())
  employeeId String   @map("employee_id") @db.Uuid
  skillId    Int      @map("skill_id")
  level      Int      // 1..5（アプリ側 Zod でバリデーション）
  startDate  DateTime @map("start_date") @db.Date
  createdAt  DateTime @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  skill    Skill    @relation(fields: [skillId], references: [id], onDelete: Restrict)

  @@index([employeeId, skillId, startDate], map: "employee_skills_employee_skill_date_idx")
  @@map("employee_skills")
}
```

設計メモ:
- `startDate` は **NOT NULL**（「最新＝現レベル」判定の軸なので必須）。デフォルトは `getTodayJST()`
- `createdAt` は**タイブレーカー**。同一 `start_date` に複数追記された場合の順序保証に使う
  （ただしクエリのタイブレーカーは `id DESC` を採用。`id` は autoincrement で挿入順と単調に一致するため確実）
- `skill` は `onDelete: Restrict`（割当が残るスキルはマスタ削除不可）。`positions` と同じ方針
- `employee` は `onDelete: Cascade`（社員削除時に割当も消える）。既存の割当系と同じ

### 3.3 Employee モデルへのリレーション追加

```prisma
model Employee {
  // ...既存フィールド...
  skills EmployeeSkill[]   // 追加
  // ...
}
```

### 3.4 現レベルビュー: `employee_current_skills`

Prisma の migration に生SQLで追加する（Prisma は `migrate dev` の中で手書きSQLを実行可能）。

```sql
CREATE VIEW employee_current_skills AS
SELECT DISTINCT ON (employee_id, skill_id)
  id,
  employee_id,
  skill_id,
  level,
  start_date,
  created_at
FROM employee_skills
ORDER BY employee_id, skill_id, start_date DESC, id DESC;
```

- `DISTINCT ON (employee_id, skill_id)` + `ORDER BY ... start_date DESC, id DESC`
  → 各 (社員, スキル) の**最新1行だけ**を返す
- ビューは実体を持たないので「純・追記専用」の思想を崩さない
- 読み手（UI / CSVエクスポート / 将来の他機能）は
  `SELECT * FROM employee_current_skills` で現レベルを素直に取得できる

**Prisma からの読み方（2択）**:
- (推奨) `lib/db/skills.ts` に `prisma.$queryRaw` でビューを叩く関数を1つ用意
  → Prisma のプレビュー機能（`views`）に依存せず、既存の生SQLパターンで完結
- あるいは Prisma の `view` モデル（`previewFeatures = ["views"]`）でマッピング
  → 型が付くが preview 依存が増える。今回は上を推奨

---

## 4. データフロー（既存流儀に準拠）

```
一覧表示: Page(Server Component) → lib/db/skills.ts → employee_current_skills ビュー
レベル付与: Form(Client) → lib/actions/skill-actions.ts → requireAuth() → Zod → INSERT → revalidatePath()
訂正:      → lib/actions/skill-actions.ts → requireAuth() → 物理DELETE → revalidatePath()
```

### 4.1 Zod スキーマ（`lib/validators.ts` に追加）

```ts
export const skillLevelSchema = z.object({
  employeeId: z.string().uuid(),
  skillId: z.coerce.number().int().positive(),
  level: z.coerce.number().int().min(1).max(5),
  startDate: z.coerce.date().optional(), // 省略時は getTodayJST()
})

// スキルマスタCRUD（positions と同型）
export const skillSchema = z.object({
  skillCode: z.string().min(1).max(20),
  skillName: z.string().min(1).max(50),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})
```

### 4.2 Server Actions（`lib/actions/skill-actions.ts` 新規）

- `assignSkillLevel(input)`:
  - `requireAuth()` → Zod → **INSERT のみ**
  - **ソフトガード**: 現在の最新レベルと同値なら弾く（無意味な重複追記を防ぐ）。
    降格や再付与は許容するので、これは DB制約ではなくアプリ側の任意チェック
  - `startDate` 未指定なら `getTodayJST()`
  - `revalidatePath()`
- `deleteEmployeeSkill(id)`:
  - `requireAuth()` → 物理DELETE → `revalidatePath()`
- スキルマスタCRUD（`createSkill` / `updateSkill` / `deleteSkill`）: `positions` の実装を流用

---

## 5. UI 面

- **スキルマスタ管理画面**: `positions` 管理画面のクローン（コード/名称/有効/並び順）
- **社員詳細画面へのスキル欄追加**: 現在のスキルレベル一覧（ビュー由来）＋「レベルを付与」ボタン
- **レベルアップ操作**: 新しいレベルと付与日を入力 → INSERT（過去行はそのまま）
- **履歴表示（任意）**: 特定 (社員, スキル) の `employee_skills` 全行を `start_date` 降順で並べれば、
  そのままレベル推移のタイムラインになる（別テーブル不要なのが効いてくる）

---

## 6. エッジケース / 決めておくこと

| ケース | 扱い |
|--------|------|
| 同一 `start_date` に複数追記 | クエリの `id DESC` タイブレーカーで最後の挿入が「最新」 |
| 同じレベルの重複追記 | Server Action のソフトガードで弾く（DB制約は張らない） |
| 誤登録の訂正 | 対象行を物理DELETE。直前の行が自動的に「最新」に戻る |
| スキルマスタ削除 | 割当が残る場合は `onDelete: Restrict` で禁止。`isActive=false` で論理無効化を推奨 |
| 未来日付の付与 | `start_date` が未来でも「最新」になり得る。運用ルールで縛るか、UIで当日以前に制限するか要判断（初期は制限なしで可） |
| CSVエクスポート | `employee_current_skills` ビューをそのまま `rowsToCsv()` に流せる |

**残す小さな判断（実装時でOK）**:
- 未来日付の付与を許すか（初期は許容で問題なし）
- ソフトガードを「同値レベル拒否」だけにするか、「現レベル未満も拒否（降格禁止）」まで踏み込むか

---

## 7. 実装タスク順序（並列可否付き）

1. **[並列]** Prisma スキーマに `Skill` / `EmployeeSkill` 追加 + `Employee` にリレーション + `docs/shift_database_schema_v9.md` 更新
2. `npx prisma migrate dev` でマイグレーション作成 → 同マイグレーションに **ビュー作成SQL** を追記
3. **[並列]** `lib/validators.ts` に Zod スキーマ追加 / `lib/db/skills.ts` にビュー読取関数
4. `lib/actions/skill-actions.ts`（assign / delete / マスタCRUD）
5. **[並列]** スキルマスタ管理画面 / 社員詳細のスキル欄
6. **[並列]** テスト: `tests/validators/`（Zod）/ `tests/actions/`（INSERT・DELETE・ソフトガード）/ `tests/db/`（ビューの最新1行取得）

---

## 8. The Assignment（次にやる具体アクション）

**まず「現レベルビュー」が意図通り動くことを、スキーマ全体を書く前に検証する。**

理由: この設計の心臓は `DISTINCT ON` ビューが「各スキルの最新1行」を正しく返すこと。
ここさえ確信できれば残りは既存パターンの流用で機械的に進む。

具体手順:
1. テストDB（`.env.test`）に `employee_skills` テーブルとビューだけを手で作る
2. 1人の社員 × 1スキルで、`start_date` 違い・同 `start_date` で `id` 違いの行を数件INSERT
3. `SELECT * FROM employee_current_skills` が**期待通り最新1行だけ**を返すか確認
4. 特に「同一 `start_date` で `id` が新しい行が勝つ」ことを確認（タイブレーカー検証）

これが緑になったら、セクション7の順序で本実装に入る。
