# 業務管理（月次）所属フィルター仕様

作成日: 2026-05-21
ブランチ: develop
ステータス: DRAFT
スコープ: `app/(main)/duty-assignments` の月次ビュー (`viewMode === "monthly"`)

---

## 問題定義

業務管理（月次）画面の所属グループ／機能ロール／役職フィルターについて、「誰を所属者とみなして表示するか」の判定基準が現状コードでは曖昧かつ実態と乖離している。

具体的には `lib/db/duty-assignments.ts` の `getDutyAssignmentsForCalendar()` 内で、所属判定が `getTodayJST()`（本日）を基準に行われている。これにより、例えば 2 月の業務割当を 5 月時点で参照すると、5 月時点の所属でフィルターされてしまい、その月の業務状況を正しく振り返れない。

## 現状の実装

`lib/db/duty-assignments.ts:135-138`:

```ts
const today = getTodayJST()
const todayStr = `${today.getUTCFullYear()}-...`
const groupDateFilter = currentGroupDateWhere(today)
const roleDateFilter = currentRoleDateWhere(today)
```

- グループフィルター: 実装済み (today 基準)
- 機能ロール (FunctionRole) フィルター: 実装済み (today 基準)
- 役職 (Position) フィルター: **未実装**

複数選択時の OR ロジック（`some: { groupId: { in: [...] } }`）は既に正しく動作しており、変更不要。

## 採用する判定基準

**期間オーバーラップ判定** — 選択した年月の期間と、各従業員の所属期間（`startDate`〜`endDate`）が **1 日でも重なれば「その月の所属者」とみなす**。

### 形式定義

選択月の期間を `[monthStart, monthEnd]` とする（両端含む）。
従業員の所属レコード `(startDate, endDate)` が以下を満たすとき、その所属はその月に有効とみなす:

```
(startDate IS NULL OR startDate <= monthEnd)
  AND
(endDate IS NULL OR endDate >= monthStart)
```

### 採用理由

- 月中に退職／異動した従業員もその月の業務管理ビューに残るため、業務記録の網羅性が保てる
- 月初／月末スナップショットでは取りこぼす「月の一部だけ所属していた人」を救える
- 既存の OR フィルター（複数グループ指定時の `IN` 条件）と自然に組み合わせ可能

### 不採用案

- **月末時点スナップショット**: 月中退職者が消える → 振り返りに使えない
- **月初時点スナップショット**: 月中入社者が漏れる → 同じく不適切
- **today 基準（現状）**: そもそも選択月と無関係であり、バグ相当

## 複数所属時の挙動

ある従業員が複数のグループ／ロール／役職に同時所属している場合、フィルターで選択した条件のうち **いずれかに該当すれば表示する**（OR）。

例: 従業員 X がグループ「A」「B」に所属している状態で、フィルターに「A」を指定 → X は表示される。「C」を指定 → X は表示されない。「A」「C」を指定 → X は表示される。

これは既存の Prisma `some: { in: [...] }` および Raw SQL `= ANY(...)` の挙動と一致しており、追加実装は不要。仕様として明文化することで以下を確実にする:

- 将来 AND 条件への変更要望が出た場合の判断材料とする
- 役職フィルター追加時にも同じ OR ロジックを踏襲する

## 役職 (Position) フィルター方針

**本設計書では仕様方針のみ定義し、UI 追加は別タスクとする。**

役職フィルターを追加する際は、本設計書で定めた以下の規約に従う:

- **判定基準**: 選択月との期間オーバーラップ
- **複数選択**: OR（いずれかの役職に該当すれば表示）
- **未割当フィルター**: グループ・ロールと同様、`{positionType}Unassigned` クエリパラメーターで提供

スキーマ上は `EmployeePosition`（`employee_positions` テーブル）に `startDate`/`endDate` カラムが既に存在し、グループ／ロールと同じ構造で扱える。

## 影響範囲（実装ガイド）

### DRY: 期間判定ヘルパー関数の抽出

期間オーバーラップ条件と月末スナップショット条件は、Raw SQL クエリ・Prisma findMany・Prisma count の **3 箇所** で必要となる。条件式の二重管理を防ぐため、以下 4 つのヘルパー関数を `lib/db/duty-assignments.ts` 冒頭に抽出する。

```ts
// Prisma where 用（findMany / count）
function monthOverlapGroupWhere(monthStart: Date, monthEnd: Date) {
  return {
    AND: [
      { OR: [{ startDate: null }, { startDate: { lte: monthEnd } }] },
      { OR: [{ endDate: null }, { endDate: { gte: monthStart } }] },
    ],
  }
}

function monthOverlapRoleWhere(monthStart: Date, monthEnd: Date) {
  // 同上（EmployeeFunctionRole 用）
}

// Raw SQL alias は literal union で型レベル制限（任意文字列の注入を防ぐ）
type GroupTableAlias = "eg2" | "eg_sort"
type RoleTableAlias = "efr" | "efr_sort"

// Raw SQL 用（ソート LEFT JOIN）
function monthEndSnapshotGroupSql(monthEndStr: string, alias: GroupTableAlias) {
  return Prisma.sql`(${Prisma.raw(alias)}.start_date IS NULL OR ${Prisma.raw(alias)}.start_date <= ${monthEndStr}::date)
    AND (${Prisma.raw(alias)}.end_date IS NULL OR ${Prisma.raw(alias)}.end_date >= ${monthEndStr}::date)`
}

// Raw SQL 用（フィルター EXISTS）
function monthOverlapGroupSql(monthStartStr: string, monthEndStr: string, alias: GroupTableAlias) {
  return Prisma.sql`(${Prisma.raw(alias)}.start_date IS NULL OR ${Prisma.raw(alias)}.start_date <= ${monthEndStr}::date)
    AND (${Prisma.raw(alias)}.end_date IS NULL OR ${Prisma.raw(alias)}.end_date >= ${monthStartStr}::date)`
}
```

**重要: SQL alias の型安全化**

Eng review Outside Voice (2026-05-21) で `Prisma.raw(alias)` が文字列をエスケープしない点が指摘された。alias 引数を `string` ではなく **literal union 型** (`GroupTableAlias`, `RoleTableAlias`) で受け取ることで、任意文字列の注入を **TypeScript の型システムでコンパイル時に防ぐ**。runtime SQL injection テストは不要、構造的に閉じ込める。

各ヘルパーには独立した単体テストを書く（5+ ケース）。

### 修正対象

| 対象 | 変更内容 |
|------|---------|
| `lib/db/duty-assignments.ts` | 上記 4 ヘルパー関数を抽出。`getDutyAssignmentsForCalendar()` 内の 3 箇所（Raw SQL / Prisma findMany / Prisma count）で使い回す |
| 同ファイル Raw SQL EXISTS | `monthOverlapGroupSql(monthStartStr, monthEndStr, "eg2")` を呼ぶ |
| 同ファイル Raw SQL ORDER BY 用 LEFT JOIN | エイリアスを `eg` → `eg_sort` / `g` → `g_sort` に変更し、`monthEndSnapshotGroupSql(monthEndStr, "eg_sort")` を呼ぶ |
| 同ファイル Prisma findMany | `groups` include の where に `monthOverlapGroupWhere(monthStart, monthEnd)` を渡す。さらに `orderBy: { groupId: "asc" }` を追加 |
| 同ファイル Prisma count | `groups.some` / `none` の条件に `monthOverlapGroupWhere(monthStart, monthEnd)` を渡す |
| 同ファイル line 346, 383 | `const groupName = emp.groups[0]?.group.name ?? null` を `const groupNames = emp.groups.map((eg) => eg.group.name)` に変更（orderBy 済みなので JS sort 不要） |
| `types/duties.ts:19` | `groupName: string \| null` → `groupNames: string[]` |
| `components/duty-assignments/duty-monthly-calendar.tsx` | 行ヘッダーに Badge 群・退職 Badge・未割当テキスト追加（「UI 表示仕様」セクション参照） |
| `components/shifts/group-multi-select.tsx` / `role-multi-select.tsx` 横 | i アイコン + Popover 追加（「ユーザー向け説明 UI」セクション参照） |
| `tests/components/duty-monthly-calendar-auth.test.tsx:104` | テストデータ `groupName: null` → `groupNames: []` |
| `prisma/migrations/<timestamp>_add_junction_table_indexes/migration.sql` | 新規 migration: `(employee_id, start_date, end_date)` 複合インデックスを `employee_groups`, `employee_function_roles` に追加 |

### 影響を受けない箇所

- 日次ビュー (`viewMode === "daily"`) — そちらは `dailyDate` をピンポイントで使えば良く、本仕様の対象外
- グループ／ロールの管理画面、シフト管理 — 別ロジックなので無関係
- 履歴テーブル (`employee_group_history` 等) — トリガー側は変更不要
- Prisma スキーマ — 変更不要

## 所属グループ表示と並び順の仕様

判定（フィルター）／表示／ソートは **目的が異なるため、それぞれ独立した基準** を採用する。混乱を避けるため以下に明示する。

| 用途 | 基準 | 採用理由 |
|------|------|---------|
| フィルター判定 | 選択月との期間オーバーラップ | 月中異動・退職者を取りこぼさない |
| グループ表示（行ヘッダー） | 選択月内に有効だった所属を **全件併記** | 月中異動者の所属遷移を可視化する |
| 並び順（ソート） | 選択月 **月末時点** の所属グループ ID | 業務的な「現所属順」の直感に近い／退職者は末尾に集まる |

### グループ表示（`DutyCalendarData.groupName`）の改修

現状の `groupName: string | null` を **`groupNames: string[]`** に変更する（複数所属対応）。

- 取得元: `emp.groups` のうち、期間オーバーラップ条件で抽出されたもの
- 並び順: グループ ID 昇順（安定した表示順）
- 旧フィールド名 `groupName` は型からも削除する。`DutyCalendarData` の参照箇所は型エラーで自動検出されるが、現状 UI では未使用のため影響は限定的

### UI 表示仕様（行ヘッダーセル）

月次カレンダーの行ヘッダーで `groupNames` を以下の規約で描画する。

**表示形式: shadcn Badge チップ形式**

```tsx
<ul role="list" className="flex flex-wrap gap-1 list-none max-w-[220px]">
  {groupNames.map((name) => (
    <li key={name}>
      <Badge
        variant="secondary"
        className="max-w-[120px] truncate"
        title={name}
      >
        {name}
      </Badge>
    </li>
  ))}
</ul>
```

| 観点 | 仕様 |
|------|------|
| 色 | 全 Badge を `variant="secondary"`（中立グレー）。グループ別の色分けはしない（色覚アクセシビリティ・情報を生まない） |
| 長文字 | Badge 内 `max-w-[120px]` + `truncate`、`title` 属性で hover 全文表示 |
| 多件数 | 上限なし、`flex-wrap` で折り返し、列幅 `max-w-[220px]` |
| 並び順 | グループ ID 昇順（クエリ側で `OrderBy: { groupId: "asc" }`） |
| 空配列 `[]` | `<span className="text-muted-foreground italic text-sm" aria-label="所属グループなし">未割当</span>` を表示 |

**退職者表示（月中退職者）**

月中退職者は期間オーバーラップ判定で月次ビューに表示される。**現在在籍者と視覚的に区別する** ため、社員名横に「退職」Badge を併記する。

```tsx
<div className="flex items-center gap-2">
  <span>{employeeName}</span>
  {isTerminated && (
    <Badge variant="destructive" aria-label="退職" title={`${terminationDate} 退職`}>
      退職
    </Badge>
  )}
</div>
```

判定: `terminationDate !== null AND terminationDate <= monthEnd` を満たす場合に退職 Badge を表示。

**重要: terminationDate を source of truth とする**

`employees.terminationDate`（社員の退職日）と `employee_groups.endDate`（所属期間の終了日）は **データモデル上独立しており**、社員退職時に endDate が自動更新される保証はない（トリガー未確認、運用上手動更新の可能性）。データ不整合（例: terminationDate が設定されているが endDate が NULL のまま）が発生した場合の優先順位:

| 用途 | 優先する値 | 挙動 |
|------|----------|------|
| 表示対象判定（フィルター） | `terminationDate` も `endDate` も尊重（OR） | どちらかで「その月に在籍」と読めれば表示 |
| 退職 Badge 表示 | `terminationDate` | endDate に関わらず terminationDate が `<= monthEnd` なら退職 Badge |
| ソート（月末非所属判定） | `terminationDate` | terminationDate が `<= monthEnd` なら末尾に集める（endDate 未更新でも） |
| グループ Badge の中身 | `endDate` ベース（期間オーバーラップ） | endDate が未更新ならその所属は残る（実装者責任で endDate を整備） |

つまり「**退職判定は `terminationDate` を見る、所属期間判定は `endDate` を見る**」と分離する。これにより:
- endDate 未更新の退職者でも、退職 Badge は正しく表示される
- endDate 未更新でも所属が残ってしまう問題は、別途データクレンジング・トリガー追加で対応（本プラン範囲外、TODO 化を検討）

実装ガイド: `lib/db/duty-assignments.ts` の従業員選択クエリで `terminationDate` 条件は **そのまま維持**（既存ロジックの OR 句）。新規追加の期間オーバーラップ条件は `employee_groups.endDate` のみを参照する。

### CSV エクスポートについて

**本プランのスコープから外す。** Eng review (2026-05-21) で `app/api/duty-assignments/export/route.ts` の現状を確認した結果、現状 CSV エクスポートは:

- `getDutyAssignmentsForCalendar()` を経由していない（独自 Prisma クエリ）
- グループ名カラムが存在しない（行ベース・業務割当中心の出力）
- フィルター（groupIds, roleIds など）を反映しない（dutyTypeIds のみ）
- 認証ガード未設定（要別途確認）

設計書の前提（「`groupNames.join(" / ")`」）が成立しないため、CSV 改修は別タスクに切り出した。TODOS.md に「業務管理 CSV エクスポートのフィルター・グループ名対応」として登録する。

### アクセシビリティ仕様

| 要素 | a11y 仕様 |
|------|----------|
| グループ Badge 群 | `<ul role="list">` + `<li>` でグループ化（リスト読み上げ） |
| 退職 Badge | `aria-label="退職"` + `title` 属性で退職日 |
| 未割当テキスト | `aria-label="所属グループなし"` |
| 長文切り詰め Badge | `title` 属性で hover 全文（ネイティブツールチップ） |
| レスポンシブ | 既存月次カレンダーの横スクロール踏襲（本プランで仕様変更なし） |

WCAG 2.1 AA 相当の読み上げ体験を確保する。スクリーンリーダーは「リスト 2 個: 人事企画、システム」「退職」のように順に読む。

### ユーザー向け説明 UI

判定／表示／ソートで基準が 3 つに分かれることをユーザーが理解できるよう、**グループ・ロールフィルター UI の横に「i」アイコン + Popover** を配置する。

```tsx
<div className="flex items-center gap-1">
  <GroupMultiSelect ... />
  <Popover>
    <PopoverTrigger>
      <Info className="size-4 text-muted-foreground" aria-label="フィルター仕様の説明" />
    </PopoverTrigger>
    <PopoverContent>
      <p>この月に <strong>1 日でも所属していた人</strong> を表示します。</p>
      <p className="mt-2 text-xs text-muted-foreground">
        並び順は月末時点の所属グループ順。月中退職者は末尾に並びます。
      </p>
    </PopoverContent>
  </Popover>
</div>
```

ロールフィルターにも同様の i アイコンを配置（文言の「グループ」を「ロール」に置き換え）。

### 並び順（`ORDER BY`）の改修

現状:
```sql
ORDER BY MIN(g.id) ASC NULLS LAST, e.name ASC
```

変更後の意味: 「選択月の月末日 (`monthEndStr`) 時点で有効な所属グループの最小 ID」で昇順。月末時点で所属がない人（その日までに退職／在籍なし）は `NULLS LAST` で末尾に集まる。

実装方針: ORDER BY 用の LEFT JOIN だけ、フィルター側と独立した日付条件 (`= monthEndStr`) を使う。

```sql
LEFT JOIN employee_groups eg_sort
  ON e.id = eg_sort.employee_id
  AND (eg_sort.start_date IS NULL OR eg_sort.start_date <= ${monthEndStr}::date)
  AND (eg_sort.end_date   IS NULL OR eg_sort.end_date   >= ${monthEndStr}::date)
LEFT JOIN groups g_sort ON eg_sort.group_id = g_sort.id
...
ORDER BY MIN(g_sort.id) ASC NULLS LAST, e.name ASC
```

フィルター用 JOIN（期間オーバーラップ）と、ソート用 JOIN（月末スナップショット）を **エイリアスで分離する** こと。

### 注意点

- フィルター結果には含まれるが月末時点では所属がない従業員（月中退職者など）は、ソート上は末尾に並ぶ
- これは仕様。ユーザーには「月末時点での組織図に沿った並びで、退職者は末尾」と説明できる
- グループ表示（全件併記）と、並び順（月末時点 1 グループ）の基準がずれることはユーザー向けドキュメント／ツールチップで補足することを推奨

## CSV エクスポートへの影響

`app/api/duty-assignments/export/route.ts` にエクスポート API が存在する。本仕様変更により、エクスポート対象の従業員集合とグループ名カラムの両方が影響を受ける可能性がある。

実装時の確認事項:

- エクスポート API も `getDutyAssignmentsForCalendar()` 経由か別経路か
- 別経路の場合、同じ判定基準（期間オーバーラップ・月末ソート・全件併記）を適用する
- グループ名カラムの区切り文字は CSV パース時に問題にならない文字（`/` や `|` 等）を選ぶ

## テスト観点（実装時の checklist）

### ヘルパー関数の単体テスト（新規）

- `monthOverlapGroupWhere(monthStart, monthEnd)`: 4 種の startDate/endDate パターンで正しい where 条件を返す
- `monthOverlapRoleWhere`: 同上
- `monthEndSnapshotGroupSql(monthEndStr, alias)`: 期待される Prisma.sql を返す
- `monthOverlapGroupSql(monthStartStr, monthEndStr, alias)`: 期待される Prisma.sql を返す

alias 引数は literal union 型で型レベル制限済みのため、SQL injection runtime テストは不要（コンパイル時に防がれる）。

### フィルター判定（期間オーバーラップ）

- 月初に退職した従業員: その月に表示されること
- 月末に退職した従業員: その月に表示されること
- 翌月に退職した従業員: その月に表示されること
- 前月退職済み: その月には表示されないこと
- 月中に異動（A → B）した従業員: A と B どちらのグループフィルターでも表示されること
- 複数グループ同時所属者: いずれかのグループ選択で表示されること
- 未割当フィルター: 選択月内に有効な所属が一つもない人だけが表示されること

### グループ表示（全件併記）

- 単一グループ所属者: `groupNames` が 1 件
- 月中異動者（A → B）: `groupNames` に A・B 両方が含まれる
- 月内全期間で複数グループ並列所属: 並列している全グループが含まれる
- 月内に所属がない（未割当）従業員: `groupNames` は空配列 `[]`

### 並び順（月末スナップショット）

- 月末時点で所属している人: そのグループ ID で並ぶ
- 月末時点で複数グループ所属: 最小グループ ID で並ぶ
- 月中退職者（月末は非所属）: 末尾に並ぶ
- 月末異動者（異動先のグループに月末時点で所属）: 異動先グループ ID で並ぶ

### UI 表示・a11y

- 1 件所属: Badge 1 件表示
- 複数所属: Badge が flex-wrap で折り返される
- 30 文字超のグループ名: Badge が truncate され、hover で title 全文表示
- 空配列: 「未割当」テキストが表示される
- スクリーンリーダー: Badge 群が「リスト 2 個」として読み上げられる
- グループ・ロールフィルター UI 横の i アイコン: クリックで Popover 表示
- Popover の開閉が ESC キー・外側クリックで動作する

### 退職者バッジ表示（境界テスト）

- 退職日 == 月末日: 退職 Badge を表示（月末時点で在籍と扱う）
- 退職日 == 月初日: 退職 Badge を表示
- 退職日 == 月初の前日（前月末退職）: そもそも月次ビューに表示されない（フィルター判定で除外）
- terminationDate IS NULL（現役）: 退職 Badge を表示しない
- 退職日が翌月以降: 退職 Badge を表示しない

### データ不整合シナリオ（terminationDate vs endDate）

- terminationDate 設定済み・endDate NULL（運用ミス想定）: 退職 Badge は表示、所属 Badge も残る（endDate 未更新を視覚化）
- terminationDate NULL・endDate 設定済み: 退職 Badge は非表示、その所属だけが期間判定で除外
- terminationDate と endDate が一致: 通常ケース、Badge 表示・所属除外ともに正しく動作

## 設計判断のサマリ

| 項目 | 決定 | 理由 |
|------|-----|------|
| 判定基準 | 期間オーバーラップ | 月中異動・退職者を取りこぼさない |
| 複数選択 | OR | 既存実装と一致、業務直感にも合う |
| グループ表示 | `groupNames: string[]` で全件併記 | 月中異動者の所属遷移を可視化 |
| ソート | 月末時点の所属グループ ID（退職者は末尾） | 業務的な「現所属順」の直感に近い |
| 役職フィルター | 方針記載のみ | スコープを絞り、UI 追加は別タスク |
| データモデル | 変更なし | 既存スキーマで対応可能 |
| 履歴テーブル | 影響なし | 読み取り側のみの修正 |

## Migration SQL 例

新規 migration: `prisma/migrations/<timestamp>_add_junction_table_indexes/migration.sql`

```sql
-- 期間オーバーラップ判定とソート用 LEFT JOIN のパフォーマンス改善
CREATE INDEX IF NOT EXISTS "employee_groups_employee_dates_idx"
  ON "employee_groups" ("employee_id", "start_date", "end_date");

CREATE INDEX IF NOT EXISTS "employee_function_roles_employee_dates_idx"
  ON "employee_function_roles" ("employee_id", "start_date", "end_date");
```

`employee_positions` テーブルへの同等インデックスは役職フィルター UI 追加タスクで実装する。

## Performance 評価

| 観点 | 評価 |
|------|------|
| N+1 クエリ | なし（既存 `include` パターン踏襲） |
| クエリ複雑度 | 現状と同等（JOIN 数不変、条件式の構造のみ変化） |
| ページネーション | 既存 `cursor + pageSize=50` 踏襲 |
| インデックス効果 | `(employee_id, start_date, end_date)` 複合インデックスで、期間オーバーラップ判定とソート LEFT JOIN の両方が index scan に切り替わる見込み |
| 既存 today 基準クエリ | 本 migration により同じく改善される（副次効果） |

## NOT in scope（本設計書で明示的に取り扱わないこと）

- **既存月次カレンダー全体の a11y 改修** — Badge 群の a11y は本プランで担保するが、`duty-monthly-calendar.tsx` 全体の aria 属性追加・focus-visible スタイル・ARIA live region は別タスク
- **役職フィルター UI の追加** — スキーマ対応は既存、UI 追加は別タスク（本書では方針のみ記載）
- **業務管理 CSV エクスポートのフィルター・グループ名対応** — Eng review (2026-05-21) で現状 CSV ロジックが本プラン前提と乖離していることが判明、別タスク化（TODOS.md 登録）
- **CSV エクスポート route の認証ガード追加** — 現状 `app/api/duty-assignments/export/route.ts` に `auth()` ガードがない（CLAUDE.md の規約と齟齬の可能性）。GET だから許容かレビュー漏れか別途判断、いずれにせよ本プラン範囲外
- **グループ別カラーカスタマイズ** — `groups` テーブルに color カラム追加してシフトコード同様にグループ別色分けする案は scope 外
- **employee_positions の (employee_id, start_date, end_date) インデックス追加** — 役職フィルター UI 追加タスクと併せて実施
- **タブレット／モバイル最適化** — 既存月次カレンダーが横スクロール前提で、本プランで仕様変更なし

## What already exists（既存の活用）

- `components/ui/badge.tsx` — shadcn Badge コンポーネント（variants: default, secondary, destructive, outline）
- `components/ui/popover.tsx` — i アイコン Popover に流用
- `docs/style-guide.md` — `text-muted-foreground`, `italic`, secondary トークン
- `components/shifts/group-multi-select.tsx`, `role-multi-select.tsx` — フィルター UI（i アイコンはこれらの横に追加）
- `lucide-react` の `Info` アイコン（既存依存）

## オープン課題

なし（design review Pass 2 / 6 / 7 で全て確定）。
