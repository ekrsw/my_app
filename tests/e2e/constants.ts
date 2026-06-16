import path from "node:path"

// 認証付き E2E の storageState 保存先（単一ソース）。
// auth.setup.ts が /login 後の認証状態をここへ保存し、
// playwright.config.ts の各認証必須プロジェクトがここから読み込む。
// __dirname は tests/e2e なので、絶対パスは tests/e2e/.auth/user.json になる。
export const STORAGE_STATE = path.resolve(__dirname, ".auth/user.json")

// セッション絶対期限スモーク（chromium-expiry）専用の設定（単一ソース）。
// 短期限を効かせた専用サーバーを別ポートで立て、このプロジェクトだけそこを向ける。
// 同一サーバーを短期限にすると他の認証必須 E2E の storageState が即失効して壊れるため分離する。
export const EXPIRY_TTL_SECONDS = 2
// 3000 番台は他プロジェクトの dev サーバーと衝突しやすいため、衝突しにくい高ポートを既定にする。
// `E2E_EXPIRY_PORT` で上書き可能（環境に応じて空きポートを指定できる）。
export const EXPIRY_PORT = Number(process.env.E2E_EXPIRY_PORT) || 34117
export const EXPIRY_BASE_URL = `http://localhost:${EXPIRY_PORT}`
