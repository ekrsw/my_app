This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

プロジェクトルートに `.env` ファイルを作成し、DB 接続先を設定してください。

```
DATABASE_URL="postgresql://my_user:password@localhost:5432/shift_database"
```

> `my_user` と `password` の部分は、手順 3 で作成したユーザー名・パスワードに置き換えてください。`postgres` ユーザーを使用する場合は `postgresql://postgres:password@localhost:5432/shift_database` としてください。

### 5. データベースのセットアップ

```bash
# Prisma クライアント生成
npx prisma generate

# マイグレーション実行（テーブル・トリガー作成）
npx prisma migrate deploy
```

### 6. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開いて確認してください。

## トラブルシューティング

### マイグレーションエラー

#### P3009: 失敗したマイグレーションが存在する

`npx prisma migrate deploy` 実行時に以下のエラーが表示される場合：

```
Error: P3009
migrate found failed migrations in the target database
```

**原因**: 過去のマイグレーションが失敗した状態で記録されている

**解決方法**:

```bash
# 1. 失敗したマイグレーションをロールバック済みとしてマーク
npx prisma migrate resolve --rolled-back <マイグレーション名>

# 2. マイグレーションを再実行
npx prisma migrate deploy
```

#### 42501: 権限エラー（permission denied）

マイグレーション実行時に `permission denied to create extension "btree_gist"` などのエラーが表示される場合：

**原因**: データベースユーザーに拡張機能の作成権限やデータベース所有権がない

**解決方法**:

```bash
# 1. スーパーユーザー（postgres）で必要な拡張機能を作成
psql -U postgres -d shift_database -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"

# 2. アプリケーションユーザーに権限を付与
psql -U postgres -d shift_database -c "GRANT ALL PRIVILEGES ON DATABASE shift_database TO <ユーザー名>;"
psql -U postgres -d shift_database -c "GRANT ALL PRIVILEGES ON SCHEMA public TO <ユーザー名>;"
psql -U postgres -d shift_database -c "ALTER DATABASE shift_database OWNER TO <ユーザー名>;"

# 3. 失敗したマイグレーションを解決してから再実行
npx prisma migrate resolve --rolled-back <マイグレーション名>
npx prisma migrate deploy
```

#### データベースの完全リセット

上記で解決しない場合、またはデータベースを最初からやり直したい場合（**全データが削除されます**）：

```bash
npx prisma migrate reset
```

### テスト環境エラー

#### ENOTFOUND: ホスト名が見つからない

`npm run test:setup-db` 実行時に以下のエラーが表示される場合：

```
Error: getaddrinfo ENOTFOUND your_host
```

**原因**: `.env.test` のホスト名が正しく設定されていない

**解決方法**: `.env.test` ファイルのホスト名を `localhost` に修正してください。

```
DATABASE_URL="postgresql://my_user:password@localhost:5432/shift_database_test"
```

#### 42704: btree_gist 拡張機能のエラー

テストセットアップ時に `data type uuid has no default operator class for access method "gist"` エラーが表示される場合：

**原因**: `btree_gist` 拡張機能がインストールされていない

**解決方法**: テスト用DBを削除して再セットアップしてください。セットアップスクリプトが自動で拡張機能を作成します。

```bash
# テスト用DBを削除
psql -U postgres -c "DROP DATABASE IF EXISTS shift_database_test;"

# 再セットアップ
npm run test:setup-db
```

## テスト

### テスト環境セットアップ

#### 1. 環境変数ファイルの作成

プロジェクトルートに `.env.test` ファイルを作成し、テスト用 DB の接続先を設定してください。

```
DATABASE_URL="postgresql://my_user:password@localhost:5432/shift_database_test"
```

> **重要**: ホスト名は必ず `localhost` を指定してください。`your_host` などのプレースホルダーのままだと `ENOTFOUND` エラーになります。

#### 2. テスト用データベースのセットアップ

初回またはスキーマ変更後に以下を実行してください。テスト DB の作成、拡張機能の作成、スキーマ同期、トリガー適用を自動で行います。

```bash
npm run test:setup-db
```

> **Note**: セットアップスクリプトが `btree_gist` 拡張機能と `uuid_generate_v7()` 関数を自動で作成します。ただし、拡張機能の作成にはスーパーユーザー権限が必要なため、アプリケーションユーザーに十分な権限があることを確認してください。

### テスト実行

```bash
# 全テスト実行
npm test

# ウォッチモード（ファイル変更時に自動実行）
npm run test:watch

# カバレッジ付き実行
npm run test:coverage
```

### カテゴリ別実行

```bash
# DB トリガーテスト
npx vitest run tests/triggers/

# DB クエリ層テスト
npx vitest run tests/db/

# バリデーションテスト（DB不要）
npx vitest run tests/validators/

# Server Actions テスト
npx vitest run tests/actions/
```

## 技術スタック

- [Next.js](https://nextjs.org) 16 (App Router)
- [React](https://react.dev) 19
- [Prisma](https://www.prisma.io) (PostgreSQL)
- [Zod](https://zod.dev) (バリデーション)
- [Vitest](https://vitest.dev) (テスト)
- [Tailwind CSS](https://tailwindcss.com) 4
- [shadcn/ui](https://ui.shadcn.com) (UI コンポーネント)
