// 暗号 keyring の型付きエラー。
// sealed 中の暗号操作と、アンロック失敗を呼び出し側が区別できるようにする。

/** keyring が sealed（鍵未ロード）の状態で encrypt/decrypt が呼ばれた。 */
export class KeyringSealedError extends Error {
  constructor(message = "Keyring is sealed — アンロックが必要です") {
    super(message)
    this.name = "KeyringSealedError"
  }
}

/** アンロックに失敗した（パスフレーズ誤り・鍵検証失敗など）。 */
export class KeyringUnlockError extends Error {
  constructor(message = "アンロックに失敗しました") {
    super(message)
    this.name = "KeyringUnlockError"
  }
}
