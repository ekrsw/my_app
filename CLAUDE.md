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

# Testing (requires .env.test with test DATABASE_URL)
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
- **Tailwind CSS 4** + **shadcn/ui** (new-york style) + **Radix UI**
- **Vitest** for testing, **Zod** for validation, **React Hook Form** for forms, **TanStack React Table** for data tables

### Data Flow Pattern
Server Components fetch data via `lib/db/*.ts` query functions. Mutations go through Server Actions in `lib/actions/*.ts` which validate with Zod schemas from `lib/validators.ts`, perform Prisma transactions, then call `revalidatePath()`.

```
Page (Server Component) → lib/db/ (queries) → Prisma → PostgreSQL
Form (Client Component) → lib/actions/ (Server Actions) → Zod validation → Prisma transaction → revalidatePath()
```

### Key Directories
- `lib/actions/` — Server Actions for all mutations (employee, shift, group, role, position)
- `lib/db/` — Database query functions (read operations, filtering, pagination)
- `lib/validators.ts` — All Zod schemas used for form validation
- `types/` — Application types extending Prisma generated types
- `components/ui/` — shadcn/ui base components (do not edit manually, use `npx shadcn add`)
- `app/generated/prisma/` — Prisma generated client (do not edit)

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
- Server action tests must also mock `@/lib/prisma` to use the test prisma client:
  ```typescript
  vi.mock("@/lib/prisma", () => ({ prisma: (await import("../helpers/prisma")).prisma }))
  ```
- Tests run sequentially (`fileParallelism: false`) with 30s timeout

### Path Alias
`@/*` maps to the project root (e.g., `@/lib/prisma`, `@/components/ui/button`).
