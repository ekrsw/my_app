import { readFile } from "node:fs/promises"
import path from "node:path"

/**
 * content/help/ 配下の Markdown ファイルを読み込む。
 *
 * fail-loud: 存在しないファイルを指定すると readFile が throw する。/help は動的描画
 * （(main) レイアウトの cookies() による）なので、マニフェスト(HELP_SECTIONS)の file 名と
 * 実ファイルがズレている場合はリクエスト時に throw し、error.tsx 境界でエラー表示になる
 * （空セクションを無言で出荷しない）。ファイル名と実体のズレはビルドではなく
 * tests/utils/help-sections.test.ts のマニフェスト整合性テストで早期に検知する。
 */
const HELP_CONTENT_DIR = path.join(process.cwd(), "content", "help")

export async function loadHelpSection(file: string): Promise<string> {
  const fullPath = path.join(HELP_CONTENT_DIR, file)
  return readFile(fullPath, "utf-8")
}
