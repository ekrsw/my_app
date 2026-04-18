# シフト管理システム

従業員のシフト・所属グループ・役職・ロールを管理するWebアプリケーション。PostgreSQL トリガーによる変更履歴の自動記録、Auth.js v5 による認証機能を備える。

## 技術スタック

- [Next.js](https://nextjs.org) 16 (App Router)
- [React](https://react.dev) 19
- [Prisma](https://www.prisma.io) 6 (PostgreSQL)
- [Auth.js](https://authjs.dev) v5 (next-auth@beta) + bcrypt
- [Zod](https://zod.dev) (バリデーション)
- [Vitest](https://vitest.dev) (ユニット/統合テスト)
- [Playwright](https://playwright.dev) (E2E テスト)
- [Tailwind CSS](https://tailwindcss.com) 4
- [shadcn/ui](https://ui.shadcn.com) (UI コンポーネント)

## セットアップ

### 前提条件

- [Node.js](https://nodejs.org/) v20 以上
- [PostgreSQL](https://www.postgresql.org/download/) v14 以上（ローカルで起動していること）
- Git

### 1. リポジトリのクローン

```bash
git clone <リポジトリURL>
cd my_app
```

### 2. パッケージインストール

```bash
npm install
```

### 3. データベースとユーザーの作成

PostgreSQL に接続し、データベースとアプリケーション用ユーザーを作成してください。

```bash
# データベースを作成
psql -U postgres -c "CREATE DATABASE shift_database;"

# アプリケーション用ユーザーを作成（任意）
psql -U postgres -c "CREATE USER my_user WITH PASSWORD 'password';"

# ユーザーに権限を付与
psql -U postgres -d shift_database -c "GRANT ALL PRIVILEGES ON DATABASE shift_database TO my_user;"
psql -U postgres -d shift_database -c "GRANT ALL PRIVILEGES ON SCHEMA public TO my_user;"
psql -U postgres -d shift_database -c "ALTER DATABASE shift_database OWNER TO my_user;"

# 必要な拡張機能を作成（スーパーユーザー権限が必要）
psql -U postgres -d shift_database -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

> **Note**: `postgres` ユーザーをそのまま使用する場合は、ユーザー作成と権限付与の手順はスキップできます。

### 4. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成:

```env
DATABASE_URL="postgresql://my_user:password@localhost:5432/shift_database"
AUTH_SECRET="<openssl rand -base64 32 で生成>"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<初期管理者パスワード>"
```

| 変数 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `AUTH_SECRET` | Auth.js のセッション署名キー。`openssl rand -base64 32` で生成 |
| `ADMIN_USERNAME` | 初期管理者ユーザー名 |
| `ADMIN_PASSWORD` | 初期管理者パスワード（seed 時にハッシュ化して保存） |

### 5. データベースのセットアップ

```bash
npx prisma generate       # Prisma Client 生成
npx prisma migrate deploy # マイグレーション実行（テーブル・トリガー作成）
npm run db:seed           # 管理者ユーザー作成
```

### 6. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開いて確認してください。

## 認証

### 概要

Auth.js v5 の Credentials Provider + JWT セッション戦略を使用。

| ユーザー状態 | 権限 |
|---|---|
| 未認証 | 全ページの閲覧が可能。作成・編集・削除は不可（ボタン非表示 + Server Action で拒否） |
| 認証済み | 全ページの閲覧 + 全 CRUD 操作が可能 |

### ログイン

- `/login` にアクセスしてユーザー名・パスワードでログイン
- サイドバー下部のログイン/ログアウトボタンからも操作可能

### 管理者ユーザーの作成

初期管理者は `.env` の `ADMIN_USERNAME` / `ADMIN_PASSWORD` から作成される:

```bash
npm run db:seed
```

既にユーザーが存在する場合はスキップされる。

### 認証保護の仕組み

- **Server Actions**: `lib/actions/` 配下の全 mutation 関数で `requireAuth()` により認証チェック。未認証時はエラーをスロー
- **UI（Server Component）**: `auth()` で認証状態を判定し、作成フォーム・インポートダイアログを条件表示
- **UI（Client Component）**: `useSession()` でテーブル行クリック（編集ダイアログ）を認証状態に応じて制御
- **読み取り操作**: `lib/db/` のクエリ関数は認証不要（誰でも閲覧可能）

## テスト

### テスト環境セットアップ

#### 1. 環境変数ファイルの作成

プロジェクトルートに `.env.test` ファイルを作成:

```env
DATABASE_URL="postgresql://my_user:password@localhost:5432/shift_database_test"
AUTH_SECRET="test-secret"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
```

> **重要**: ホスト名は必ず `localhost` を指定してください。

#### 2. テスト用データベースのセットアップ

初回またはスキーマ変更後に実行。テスト DB の作成、拡張機能の作成、スキーマ同期、トリガー適用を自動で行います。

```bash
npm run test:setup-db
```

### テスト実行

```bash
npm test               # vitest (ユニット/統合) のみ
npm run test:watch     # vitest ウォッチモード
npm run test:coverage  # vitest カバレッジ付き
npm run test:e2e       # Playwright E2E のみ
npm run test:e2e:ui    # Playwright を UI モードで実行 (デバッグ向け)
npm run test:all       # vitest → Playwright を直列実行
```

### カテゴリ別実行 (vitest)

```bash
npx vitest run tests/validators/    # Zod スキーマテスト（DB不要）
npx vitest run tests/db/            # DB クエリ層テスト
npx vitest run tests/actions/       # Server Action テスト
npx vitest run tests/triggers/      # DB トリガーテスト
```

### E2E テスト (Playwright)

ブラウザでの UI 挙動を検証するテストは `tests/e2e/` 配下。対象はサイドバー開閉、設定メニューの Collapsible↔DropdownMenu 切替、cookie 永続化、モバイル sheet 表示など。

#### 初回セットアップ

```bash
npm install                      # @playwright/test を含む devDependencies を取得
npx playwright install chromium  # Chromium バイナリをダウンロード (約 110MB)
```

#### 実行

```bash
npm run test:e2e              # 全 E2E テスト (chromium desktop + chromium mobile)
npm run test:e2e:ui           # UI モードで対話的にデバッグ
npx playwright test -g "smoke"  # grep でテスト絞り込み
```

Playwright は `webServer` 設定で自動的に `npm run start` を起動するため、事前に `npm run build` を済ませておくこと。

#### 社内プロキシ環境の自動対応

`HTTP_PROXY` が localhost までトンネルする環境(社内プロキシ等)では webServer への接続が失敗するため、`playwright.config.ts` 側で `NO_PROXY=localhost,127.0.0.1,::1` を自動的に付与している。ユーザーが既に `NO_PROXY` を設定している場合は尊重して merge する。通常は追加の環境変数設定は不要。

#### テストプロジェクト

`playwright.config.ts` で 2 つに分離:

| Project | Device | 対象 |
|---|---|---|
| `chromium-desktop` | Desktop Chrome (1280x800) | `describe("Sidebar — desktop")` のみ |
| `chromium-mobile` | Pixel 5 エミュレート | `describe("Sidebar — mobile")` のみ |

タッチデバイスでホバーが効かない等、プロジェクトごとに挙動が違うテストが混線しないよう `grep` でルーティングしている。

### Server Action テストの必須モック

Server Action のテストでは以下3つのモックが必要:

```typescript
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  return { prisma: (await import("../helpers/prisma")).prisma }
})
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }),
}))
```

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 (localhost:3000) |
| `npm run build` | プロダクションビルド |
| `npm run lint` | ESLint 実行 |
| `npm run db:seed` | 管理者ユーザー作成 |
| `npm run test:setup-db` | テストDB初期化 |
| `npm test` | vitest (ユニット/統合) のみ |
| `npm run test:watch` | vitest ウォッチモード |
| `npm run test:coverage` | vitest カバレッジ付き |
| `npm run test:e2e` | Playwright E2E のみ |
| `npm run test:e2e:ui` | Playwright UI モード (デバッグ) |
| `npm run test:all` | vitest → Playwright 直列実行 |
| `npx prisma generate` | Prisma Client 再生成 |
| `npx prisma migrate dev` | マイグレーション作成・適用 |
| `npx prisma migrate deploy` | マイグレーション適用（本番用） |

## トラブルシューティング

### マイグレーションエラー

#### P3009: 失敗したマイグレーションが存在する

```
Error: P3009
migrate found failed migrations in the target database
```

**解決方法**:

```bash
npx prisma migrate resolve --rolled-back <マイグレーション名>
npx prisma migrate deploy
```

#### 42501: 権限エラー（permission denied）

マイグレーション実行時に `permission denied to create extension "btree_gist"` などのエラーが表示される場合:

```bash
# スーパーユーザーで拡張機能を作成
psql -U postgres -d shift_database -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

# アプリケーションユーザーに権限を付与
psql -U postgres -d shift_database -c "GRANT ALL PRIVILEGES ON DATABASE shift_database TO <ユーザー名>;"
psql -U postgres -d shift_database -c "GRANT ALL PRIVILEGES ON SCHEMA public TO <ユーザー名>;"
psql -U postgres -d shift_database -c "ALTER DATABASE shift_database OWNER TO <ユーザー名>;"

# 失敗したマイグレーションを解決して再実行
npx prisma migrate resolve --rolled-back <マイグレーション名>
npx prisma migrate deploy
```

#### データベースの完全リセット

上記で解決しない場合（**全データが削除されます**）:

```bash
npx prisma migrate reset
```

### テスト環境エラー

#### ENOTFOUND: ホスト名が見つからない

`.env.test` のホスト名を `localhost` に修正してください。

#### 42704: btree_gist 拡張機能のエラー

テスト用DBを削除して再セットアップ:

```bash
psql -U postgres -c "DROP DATABASE IF EXISTS shift_database_test;"
npm run test:setup-db
```

#### Playwright E2E が `Timed out waiting from config.webServer`

通常は `playwright.config.ts` が `NO_PROXY` を自動設定するので発生しないはず。もし発生した場合:

1. `playwright.config.ts` の先頭に NO_PROXY マージ処理があるか確認
2. 古い Next.js プロセスが port 3000 を占有していないか: `taskkill //F //IM node.exe` で掃除してから再試行
3. `.env` / `.env.test` で `HTTP_PROXY` が別の値で上書きされていないか確認

#### Playwright が `Executable doesn't exist` を表示

Chromium バイナリが未インストール。以下を実行:

```bash
npx playwright install chromium
```
