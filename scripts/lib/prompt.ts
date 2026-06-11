// CLI 用のプロンプトヘルパー。
// パスフレーズ/リカバリコードは no-echo（入力が画面に出ない）で受ける。
// コマンドライン引数・環境変数では渡さない（履歴・プロセス一覧に残るため）。

import readline from "node:readline"

/** 入力をエコーせずに1行受け取る（パスフレーズ用）。 */
export function promptHidden(question: string): Promise<string> {
  process.stdout.write(question)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })
  // @ts-expect-error readline 内部 API: 入力文字のエコーを抑止する
  rl._writeToOutput = () => {}
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close()
      process.stdout.write("\n")
      resolve(answer.trim())
    })
  })
}

/** 通常の（エコーあり）1行プロンプト（確認応答用）。 */
export function promptVisible(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}
