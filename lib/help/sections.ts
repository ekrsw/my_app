/**
 * ヘルプセクションのマニフェスト（唯一のソース）。
 *
 * このリストが目次・各 <section id>・HelpLink の anchor・読み込む .md ファイル名の
 * すべての基準になる。anchor を型として導出することで、HelpLink への anchor 指定の
 * タイプミスをコンパイルエラーで弾く。
 *
 * 新しいヘルプセクションを足すときは、ここに1行追加し content/help/<file> を作るだけ。
 * file と実ファイルの整合性は tests/utils/help-sections.test.ts で担保（fail-loud）。
 */
export const HELP_SECTIONS = [
  { anchor: "duty-types", title: "業務種別の追加", file: "duty-types.md" },
  { anchor: "duty-assign", title: "業務割当ての追加", file: "duty-assign.md" },
  { anchor: "shift-edit", title: "シフトの変更", file: "shift-edit.md" },
  { anchor: "history", title: "変更履歴の操作", file: "history.md" },
  { anchor: "backup", title: "バックアップとリストア", file: "backup-restore.md" },
] as const

export type HelpAnchor = (typeof HELP_SECTIONS)[number]["anchor"]
