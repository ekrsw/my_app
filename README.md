This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## セットアップ

### 前提条件

- Node.js v20 以上
- PostgreSQL（ローカルで起動していること）

### 1. パッケージインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、DB 接続先を設定してください。

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/my_database"
```

### 3. データベースのセットアップ

```bash
# Prisma クライアント生成
npx prisma generate

# マイグレーション実行（テーブル・トリガー作成）
npx prisma migrate deploy
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) をブラウザで開いて確認してください。

## テスト

### テスト環境セットアップ

プロジェクトルートに `.env.test` ファイルを作成し、テスト用 DB の接続先を設定してください。

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/my_database_test"
```

初回またはスキーマ変更後に以下を実行してください。テスト DB の作成、スキーマ同期、トリガー適用を自動で行います。

```bash
npm run test:setup-db
```

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
