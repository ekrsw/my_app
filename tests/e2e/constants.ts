import path from "node:path"

// 認証付き E2E の storageState 保存先（単一ソース）。
// auth.setup.ts が /login 後の認証状態をここへ保存し、
// playwright.config.ts の各認証必須プロジェクトがここから読み込む。
// __dirname は tests/e2e なので、絶対パスは tests/e2e/.auth/user.json になる。
export const STORAGE_STATE = path.resolve(__dirname, ".auth/user.json")
