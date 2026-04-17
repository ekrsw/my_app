# TODOS

## フェーズ2: インシデントログ機能

**What:** 「対応できなかった」をワンクリックで記録できるインシデントログ機能を追加する

**Why:** ユーザーの最大の痛みは「人手不足や負担の偏りを上司に報告する際、客観的な証拠がない」こと。インシデントログがあれば、「先月、対応できなかった回数: X回」のようなデータを上司への報告材料にできる。

**Context:** フェーズ1（キャパシティダッシュボード）でリアルタイムの人員状況可視化を実装済み。フェーズ2ではこの基盤上に、対応不可イベントの記録機能を追加する。デザインドキュメント（Approach C）の「インシデントログ」部分を参照。

**Depends on:** フェーズ1（キャパシティサマリー）の完成と運用開始

## フェーズ2拡張: タイムラインヒートマップからのインシデント記録

**What:** タイムラインヒートマップのセルクリックで「対応できなかった」インシデントを記録できる機能

**Why:** ヒートマップ上で「人が少ない時間帯」が可視化されるため、その時間帯に起きた問題を即座に記録できると、フェーズ2のインシデントログ機能と自然に統合される。リーダーが事後ではなくリアルタイムに近い形で記録できる

**Effort:** M (human) → S (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** フェーズ2（インシデントログ機能）の実装、タイムラインヒートマップの完成

**Context:** タイムラインヒートマップの各セル（特に人数が少ない赤/黄色の時間帯）をクリックすると、その時間帯・メンバー情報を事前入力した状態でインシデント記録フォームが開くUX。ヒートマップ自体は読み取り専用で先行リリースし、インシデントログ機能が完成した時点でクリックハンドラーを追加する

## UX改善: 業務割当フォームでシフト時間を自動表示

**What:** 業務割当フォームで従業員と日付を選択すると、その従業員のシフト時間帯が自動表示される機能を追加する

**Why:** バリデーションでシフト外の業務はブロックされるが、リーダーは「そもそもこの人のシフトは何時？」を事前に知りたい。エラーになってから別画面で確認するのは非効率。

**Effort:** S (human) → S (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** 業務割当のシフト整合性バリデーション機能の完成

**Context:** 従業員選択・日付選択の onChange でAPIを呼び出し、シフト時間をフォーム上に表示する。シフトが未登録や休日の場合は「出勤予定なし」を表示して、そもそも送信前に気付ける。
**Note:** シフト管理への業務割当統合（ShiftDutyPanel）を先に実装した場合、シフト時間は自動プリフィルで解決済みになる可能性あり。実装後に再評価すること。

## 後続: シフト月次カレンダーへの業務ドット統合

**What:** `/shifts` の月次カレンダーセルにシフトコードと業務ドットを統合表示する。セルクリックで両方を編集できるパネルが開く。

**Why:** 「シフト管理への業務割当統合（日次ビュー）」実装後の次ステップ。月次俯瞰でシフトと業務を1画面で確認できるようになる。最終的に「業務管理」メニュー自体を廃止できる。

**Pros:** 1画面で月全体のシフト+業務が把握できる。「業務管理」メニューが不要になる。

**Cons:** ShiftCalendar コンポーネントの大改修が必要。セル密度が上がりすぎる懸念あり（前回設計書でも指摘）。

**Context:** 前回の設計書（Approach C: 統合ビュー）でリスクが高いと判断されたが、日次ビュー統合でパターンが確立された後は実現可能。業務ドットの表示は DutyMonthlyCalendar の実装を参考にする。先にシフト日次ビューへの業務統合（ShiftDutyPanel）を実装・検証してから着手すること。

**Effort:** L (human) → M (CC+gstack: ~45分) | **Priority:** P3 | **Risk:** Med

**Depends on:** シフト管理への業務割当統合（ShiftDutyPanel）の実装と運用確認

## リファクタ: CSVパーサーのconvertDate共通化

**What:** `lib/csv/parse-employee-csv.ts` と `lib/csv/parse-shift-csv.ts` と `lib/csv/parse-role-csv.ts` に重複している `convertDate` 関数を `lib/csv/utils.ts` 等に共通化する

**Why:** 同一ロジックが3ファイルに重複しており、日付フォーマット対応の追加時に3箇所修正が必要になる

**Effort:** S | **Priority:** P3 | **Risk:** Low

**Context:** 各パーサーはスタンドアロン設計で動作しており、共通化しなくても即座に問題にはならない。ただし今後インポート機能が増えるたびに重複が増える

## リファクタ: timeToInput関数の共通化

**What:** `timeToInput`関数（Date→"HH:mm"文字列変換の4行関数）を `lib/date-utils.ts` に移動し、全ファイルから参照する。

**Why:** 現在5ファイル（duty-assignment-form.tsx, attendance-edit-form.tsx, shift-form.tsx, shift-bulk-editor.tsx, shift-code-form.tsx）に同一実装が重複しており、今後のファイルでも6個目、7個目と増え続ける。

**Pros:** DRY原則遵守、将来のバグ修正が1箇所で済む。

**Cons:** 5ファイルのimportを修正する必要がある（小さい変更）。

**Context:** `lib/date-utils.ts` には既に `formatTime` (Date→"HH:mm") が存在するが、これは `date-fns` 依存でUTCオフセット補正あり。`timeToInput` は `d.toISOString().substring(11, 16)` の単純版で別物。`timeToInput` をそのまま `lib/date-utils.ts` に `export` するだけでよい。

**Effort:** S (human) → S (CC+gstack) | **Priority:** P3 | **Risk:** Low

**Depends on:** なし（独立したリファクタ）

## デザイン整合性: duty-type-summary-row.tsx 凡例のバッジ化

**What:** `duty-type-summary-row.tsx` の色ドット凡例を、月次グリッドのバッジスタイルと統一する

**Why:** 月次グリッドのセルが DutyDot（色付き丸）から DutyBadge（コードテキスト）に切り替わった後、グリッド下部の凡例行はドット表示のまま残る。「セルはバッジ、凡例はドット」という見た目の不整合が発生し、ユーザーが凡例を見てもセルの表示形式と紐付けにくくなる。

**Pros:** グリッド全体の視覚的一貫性が保たれる。凡例がセルと同じ形式になり直感的に理解しやすい。

**Cons:** 凡例行を別途修正する必要がある（小規模な変更）。

**Context:** `/plan-design-review` (2026-04-07) の Pass 7 で発見。DutyDot → DutyBadge 移行（業務管理画面刷新 v0.2.2）の完了後に着手すること。`duty-type-summary-row.tsx` の実装を確認してからバッジスタイルを合わせる。

**Effort:** XS (human) → XS (CC+gstack) | **Priority:** P3 | **Risk:** Low

**Depends on:** 業務管理画面刷新（DutyBadge実装）の完了

## バグ: bulkUpdateShifts・restoreShiftVersionのダッシュボードキャッシュ未無効化

**What:** `bulkUpdateShifts`（lib/actions/shift-actions.ts:274付近）と `restoreShiftVersion`（同:334付近）に `revalidatePath("/")` が欠落しており、一括更新・バージョン復元後にダッシュボード（`/`）が古いデータを表示し続ける可能性がある。

**Why:** `updateShift`・`deleteShift` と同様、シフト変更操作はダッシュボードのキャッシュも無効化すべき。Adversarial review (v0.2.1.2) で発見。

**Pros:** ダッシュボードの表示が一括更新・復元操作後もリアルタイムに反映される。

**Cons:** 変更は2行追加のみで軽微。

**Context:** `updateShift`/`deleteShift` には v0.2.1.2 で `revalidatePath("/")` を追加済み。`bulkUpdateShifts`（複数シフト一括更新）と `restoreShiftVersion`（シフト履歴からの復元）も同様の修正が必要。

**Effort:** XS (human) → XS (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** なし（独立した修正）

## リファクタ: DutyType ローカル型の共通化

**What:** `DutyType = { id: number; name: string; defaultReducesCapacity: boolean; ... }` がコンポーネント4箇所（duty-assignment-form.tsx:50, duty-assignment-table.tsx:11, duty-daily-view.tsx:48, duty-assignment-page-client.tsx:70）でローカル定義されている。`types/duties.ts` に `DutyTypeOption` 型を切り出して import に統一する。

**Why:** フィールド追加のたびに4箇所を同期修正する必要がある。デフォルト時刻追加で顕在化。

**Pros:** 型変更が1箇所で済む。型の不整合リスクがなくなる。

**Cons:** 4ファイルの import 修正が必要（軽微）。

**Effort:** S (human) → XS (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** デフォルト時刻機能の実装完了（このPRの後）

**Context:** `/plan-eng-review` (2026-04-10) の Step 0 で発見。duty-assignment-page-client.tsx の Props 型定義も dutyTypeOptions のインライン型を DutyTypeOption[] に置き換えられる。

## UX改善: 編集時のDutyType変更でdefault値が上書きされる問題

**What:** DutyAssignmentForm の編集モードで業務種別を変更すると、手入力済みの startTime/endTime/note が defaultXxx 値で無言で上書きされる。title のみ「新規作成時のみ自動補完」に修正済みだが、他のdefault値も同様の対応が必要。

**Why:** ユーザーが手で修正した時間や備考が、業務種別を変更しただけで消える。特に時間帯の修正は頻繁に行われるため、影響が大きい。Codex adversarial review (2026-04-11) で発見。

**Pros:** 編集時のデータ消失リスクがなくなる。ユーザーの入力が尊重される。

**Cons:** handleDutyTypeChange の条件分岐が増える（新規/編集で動作が異なる）。

**Effort:** S (human) → XS (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** タイトルカラム追加の実装完了

**Context:** duty-assignment-form.tsx:115-124 の handleDutyTypeChange が対象。現在は新規・編集問わず全 default 値を上書きする。title は今回のPRで「新規のみ」に修正されるが、startTime/endTime/note/reducesCapacity も同じパターンにすべき。

## バグ: フィルタープリセットに monthlyEmployeeSearch が含まれない

**What:** `FilterPresetManager` がURLパラメータをプリセットとして保存する際、`monthlyEmployeeSearch`（従業員名テキスト検索）が除外されている。保存したプリセットを復元しても従業員名フィルターは復元されない。

**Why:** v0.2.8.0 で従業員名検索をURLパラメータ `monthlyEmployeeSearch` に永続化したが、FilterPresetManager の保存対象パラメータに含めなかった。Adversarial review (v0.2.8.0) で発見。

**Pros:** プリセット保存・復元で従業員名フィルターも含めた完全な状態が復元される。
**Cons:** FilterPresetManager の保存ロジックに `monthlyEmployeeSearch` を追加する必要がある（軽微な変更）。

**Effort:** XS (human) → XS (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** なし（独立した修正）

**Context:** `components/duty-assignments/filter-preset-manager.tsx` の保存対象URLパラメータリストに `monthlyEmployeeSearch` を追加する。復元時も同様に適用する。

## セキュリティ: employeeSearch の LIKE 特殊文字（%/_）未エスケープ

**What:** `lib/db/duty-assignments.ts` の `getDutyAssignmentsForCalendar` 関数で、`employeeSearch` を LIKE クエリに使用する際に `%` や `_` がエスケープされていない。ユーザーが `%` を検索すると全件ヒットし、`_` は任意の1文字にマッチする。

**Why:** SQLインジェクションではなく、意図しない検索結果を招く UX バグ。`%test%` を入力すると「testを含む」ではなく「任意の文字列を含む」全件が返る。Adversarial review (v0.2.8.0) で発見。

**Pros:** 検索の精度が正確になる。ユーザーが `%` を入力してもリテラル検索が行われる。
**Cons:** エスケープ処理を追加する必要がある（小規模な変更）。

**Effort:** XS (human) → XS (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** なし（独立した修正）

**Context:** `lib/db/duty-assignments.ts` で `employeeSearch` を `{ contains: employeeSearch, mode: "insensitive" }` に使用している箇所を確認する。Prisma の場合は `%` や `_` を `\%`、`\_` にエスケープしてから渡す（または raw SQL に切り替えてプレースホルダーを使う）。

## テスト: importShifts のupsert更新パステスト

**What:** `importShifts` Server Action の upsert 更新パス（既存シフトの上書き更新）のテストが欠落している。新規作成パスはテスト済みだが、同一従業員・同一日付のシフトが既に存在する場合の更新動作がテストされていない。

**Why:** CSVインポートの主要ユースケースの一つが既存データの上書き更新。更新時にフィールドが正しく反映されるか（シフトコード変更、時間変更、休日フラグ変更など）のテストがないと、回帰バグを見逃すリスクがある。

**Effort:** S (human) → XS (CC+gstack) | **Priority:** P2 | **Risk:** Low

**Depends on:** なし（独立したテスト追加）

**Context:** `tests/actions/import-shifts.test.ts` に追加する。テストシナリオ: 1) シフトを作成 → 同じ従業員・日付で異なるシフトコードをインポート → updated=1を確認 → DBの値が更新されていることを確認。Eng Review (v0.2.15.0) で発見。

## バグ: CSVエクスポートファイル名のJST対応

**What:** 全CSVエクスポートAPI（`/api/employees/export`, `/api/shifts/export`, `/api/role-assignments/export`）のファイル名生成で `new Date()` を使用しており、サーバーのタイムゾーンが UTC の場合、JST 深夜0時〜9時にファイル名の日付が前日になる。

**Why:** `getTodayJST()` で日付計算は JST 対応済みだが、ファイル名の日付だけがサーバー依存のまま。ユーザーが「今日エクスポートしたファイル」の日付が前日になると混乱する。

**Effort:** XS (human) → XS (CC+gstack) | **Priority:** P3 | **Risk:** Low

**Depends on:** なし（独立した修正）

**Context:** 3つのエクスポートAPIルートで `const now = new Date()` → `getTodayJST()` に置き換えるだけ。Eng Review (Phase 3ロール割当て, 2026-04-17) の Outside Voice で発見。
