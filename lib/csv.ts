// CSV 出力の共通ヘルパー。
// 全エクスポート API ルートはここを経由してセルのエスケープと
// 数式インジェクション中和を行う。

// 数式インジェクションの起点になり得る先頭文字。
// = + - @ のほか、タブ/CR で始まる値も Excel/Sheets が数式として
// 解釈し得るため中和対象に含める。
const FORMULA_TRIGGER = /^[=+\-@\t\r]/

/**
 * CSV セル1つをエスケープする。
 * 1. 先頭が数式トリガー文字の場合は ' を前置し、表計算ソフトが
 *    数式として評価しないようにする（CSV インジェクション対策）。
 * 2. ダブルクォートを "" にエスケープし、全体を " で囲む。
 */
function escapeCell(value: string | number): string {
  let s = String(value)
  if (FORMULA_TRIGGER.test(s)) {
    s = `'${s}`
  }
  return `"${s.replace(/"/g, '""')}"`
}

/**
 * 2次元配列（ヘッダー行を含む）を CSV 文字列に変換する。
 * 各セルは escapeCell で中和・エスケープされる。行区切りは \n。
 */
export function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\n")
}
