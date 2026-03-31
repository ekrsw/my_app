# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language
All responses must be generated in Japanese.

## Project Overview

Employee shift management system (Japanese locale). Manages employees, groups, positions, function roles, shifts, and tracks all changes via PostgreSQL database triggers that write to history tables.

## Commands

```bash
# Development
npm run dev              # Next.js dev server at localhost:3000
npm run build            # Production build
npm run lint             # ESLint

# Authentication
npm run db:seed          # Create admin user from .env ADMIN_USERNAME/ADMIN_PASSWORD

# Testing (requires .env.test with DATABASE_URL, AUTH_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD)
npm run test:setup-db    # Initialize test DB (run once, or after schema changes)
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage

# Run specific test categories
npx vitest run tests/validators/    # Zod schema tests (no DB needed)
npx vitest run tests/db/            # Database query layer tests
npx vitest run tests/actions/       # Server action tests
npx vitest run tests/triggers/      # DB trigger tests

# Run a single test file
npx vitest run tests/actions/employee-actions.test.ts

# Database
npx prisma generate         # Regenerate client after schema changes
npx prisma migrate dev      # Create new migration
npx prisma migrate deploy   # Apply migrations
```

## Architecture

### Tech Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Prisma 6** with **PostgreSQL** (client generated to `app/generated/prisma/`)
- **Auth.js v5** (next-auth@beta) + **bcrypt** for authentication
- **Tailwind CSS 4** + **shadcn/ui** (new-york style) + **Radix UI**
- **Vitest** for testing, **Zod** for validation, **React Hook Form** for forms, **TanStack React Table** for data tables

### Data Flow Pattern
Server Components fetch data via `lib/db/*.ts` query functions. Mutations go through Server Actions in `lib/actions/*.ts` which validate with Zod schemas from `lib/validators.ts`, perform Prisma transactions, then call `revalidatePath()`.

```
Page (Server Component) → lib/db/ (queries) → Prisma → PostgreSQL
Form (Client Component) → lib/actions/ (Server Actions) → requireAuth() → Zod validation → Prisma transaction → revalidatePath()
```

### Key Directories
- `lib/actions/` — Server Actions for all mutations (employee, shift, group, role, position). All mutations require authentication via `requireAuth()`
- `lib/db/` — Database query functions (read operations, filtering, pagination). No auth required
- `lib/auth-guard.ts` — `requireAuth()` helper that throws if unauthenticated
- `lib/validators.ts` — All Zod schemas used for form validation
- `auth.ts` — Auth.js v5 configuration (Credentials Provider, JWT strategy)
- `middleware.ts` — Attaches session info to requests (does not enforce auth)
- `types/` — Application types extending Prisma generated types
- `components/auth/` — Login form and SessionProvider wrapper
- `components/ui/` — shadcn/ui base components (do not edit manually, use `npx shadcn add`)
- `app/generated/prisma/` — Prisma generated client (do not edit)

### Authentication
- Auth.js v5 with Credentials Provider + JWT sessions
- Unauthenticated users can read all pages; mutations require authentication
- Server Actions: `await requireAuth()` at the top of every mutation function
- Server Components: `auth()` from `@/auth` to get session and conditionally render create/edit/delete UI
- Client Components: `useSession()` from `next-auth/react` (wrapped in `SessionProvider` in `(main)/layout.tsx`)
- Route Groups: `(auth)/` for login page (no sidebar), `(main)/` for main app (with sidebar + SessionProvider)
- Admin user seeded via `npm run db:seed` using `ADMIN_USERNAME`/`ADMIN_PASSWORD` from `.env`

### Styling
- **スタイルガイド**: `docs/style-guide.md` — カラーシステム、タイポグラフィ、コンポーネントパターン、シフトコード配色などのスタイリング規約を定義。新規コンポーネント作成やスタイル変更時に参照すること
- `components/ui/` は手動編集禁止（`npx shadcn add` を使用）
- セマンティックカラートークン（`bg-primary`, `text-muted-foreground` 等）を優先し、Tailwind カラー直接指定はシフトコード配色など特定用途に限定

### 日付・時刻の扱い
- サーバーのタイムゾーンに依存せず、JST (UTC+9) 基準で日付比較を行うこと
- 「今日」の算出には `lib/date-utils.ts` の `getTodayJST()` を使用する（`new Date()` のローカル日付を直接使わない）
- `getTodayJST()` は Prisma `@db.Date` カラム比較用の UTC midnight Date を返す

### Database Design
- **Junction tables** for many-to-many: `employee_groups`, `employee_function_roles`, `employee_positions`
- **History tables** auto-populated by PostgreSQL triggers (PL/pgSQL in migration SQL files): `employee_group_history`, `shift_change_history`, etc.
- Prisma schema uses `@@map()` to map PascalCase models to snake_case table names
- Prisma client is imported from `@/lib/prisma` (singleton pattern)
- **Schema documentation**: `docs/shift_database_schema.md` — When the database schema changes (e.g., adding/removing tables, columns, indexes, triggers, or modifying migrations), this file must be updated to reflect the current state

### Testing Patterns
- Tests live in `tests/` organized by category: `actions/`, `db/`, `triggers/`, `validators/`
- Test DB is separate (configured via `.env.test`); `npm run test:setup-db` creates DB, syncs schema, and applies triggers
- `tests/helpers/cleanup.ts` — `cleanupDatabase()` truncates all tables; call in `beforeEach`
- `tests/helpers/mock-next.ts` — `mockNextCache()` mocks `next/cache`; required at top of server action test files
- `tests/helpers/mock-auth.ts` — `mockAuth()` mocks `@/auth`; required for server action tests
- Server action tests must mock `@/lib/prisma` and `@/auth`:
  ```typescript
  vi.mock("@/lib/prisma", () => ({ prisma: (await import("../helpers/prisma")).prisma }))
  vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { id: "1", name: "admin" } }) }))
  ```
- Tests run sequentially (`fileParallelism: false`) with 30s timeout

### Path Alias
`@/*` maps to the project root (e.g., `@/lib/prisma`, `@/components/ui/button`).

## gstack

Web ブラウジングには必ず `/browse` スキルを使用すること。`mcp__claude-in-chrome__*` ツールは使用禁止。

### 利用可能なスキル
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

### セットアップ（初回のみ）
チームメイトが初めて利用する場合は、以下を実行してgstackをインストールする:
```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

### トラブルシューティング
gstack スキルが動作しない場合は、以下を実行してバイナリのビルドとスキルの登録を行う:
```bash
cd ~/.claude/skills/gstack && ./setup
```

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
