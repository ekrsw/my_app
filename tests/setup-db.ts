import { execSync } from "child_process"
import { readFileSync } from "fs"
import path from "path"
import { Client } from "pg"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(__dirname, "../.env.test") })

const TEST_DB_URL = process.env.DATABASE_URL!
const parsed = new URL(TEST_DB_URL)
const testDbName = parsed.pathname.slice(1)

// Connection URL without database name (to connect to postgres for DB creation)
const adminUrl = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}/postgres`

async function main() {
  console.log(`Setting up test database: ${testDbName}`)

  // 1. Create test database if it doesn't exist
  const adminClient = new Client({ connectionString: adminUrl })
  await adminClient.connect()

  const result = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [testDbName]
  )

  if (result.rowCount === 0) {
    console.log(`Creating database ${testDbName}...`)
    await adminClient.query(`CREATE DATABASE "${testDbName}"`)
    console.log("Database created.")
  } else {
    console.log("Database already exists.")
  }

  await adminClient.end()

  // 2. Run prisma db push to sync schema
  console.log("Syncing schema with prisma db push...")
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  })

  // 3. Apply trigger migrations
  console.log("Applying trigger SQL...")
  const testClient = new Client({ connectionString: TEST_DB_URL })
  await testClient.connect()

  const migrationFiles = [
    "20260219000000_add_efr_constraints/migration.sql",
    "20260219100000_add_employee_group_history/migration.sql",
    "20260219200000_add_employee_name_history_trigger/migration.sql",
  ]

  for (const file of migrationFiles) {
    const filePath = path.resolve(__dirname, "../prisma/migrations", file)
    const sql = readFileSync(filePath, "utf-8")

    // Extract only trigger-related SQL (CREATE OR REPLACE FUNCTION, CREATE TRIGGER, DROP TRIGGER)
    const triggerStatements = extractTriggerStatements(sql)

    if (triggerStatements.length > 0) {
      for (const stmt of triggerStatements) {
        try {
          await testClient.query(stmt)
        } catch (err: unknown) {
          // Ignore errors for already-existing objects
          const pgErr = err as { code?: string }
          if (pgErr.code !== "42710") {
            console.error(`Error applying trigger SQL from ${file}:`, err)
          }
        }
      }
      console.log(`  Applied triggers from ${file}`)
    }
  }

  // Also apply partial unique indexes from the first migration
  const efrSql = readFileSync(
    path.resolve(
      __dirname,
      "../prisma/migrations/20260219000000_add_efr_constraints/migration.sql"
    ),
    "utf-8"
  )
  // Extract CREATE UNIQUE INDEX statements (may be preceded by SQL comments)
  const indexRegex =
    /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+[\s\S]*?;/gi
  let indexMatch
  while ((indexMatch = indexRegex.exec(efrSql)) !== null) {
    try {
      await testClient.query(indexMatch[0])
    } catch {
      // Ignore if already exists
    }
  }
  console.log("  Applied partial unique indexes")

  await testClient.end()
  console.log("Test database setup complete!")
}

function extractTriggerStatements(sql: string): string[] {
  const statements: string[] = []

  // Extract CREATE OR REPLACE FUNCTION blocks (which contain $$ delimiters)
  const funcRegex =
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+[\s\S]*?\$\$[\s\S]*?\$\$\s+LANGUAGE\s+plpgsql\s*;/gi
  let match
  while ((match = funcRegex.exec(sql)) !== null) {
    statements.push(match[0])
  }

  // Extract DROP TRIGGER statements
  const dropTriggerRegex = /DROP\s+TRIGGER\s+IF\s+EXISTS\s+[^;]+;/gi
  while ((match = dropTriggerRegex.exec(sql)) !== null) {
    statements.push(match[0])
  }

  // Extract CREATE TRIGGER statements
  const createTriggerRegex =
    /CREATE\s+TRIGGER\s+[\s\S]*?EXECUTE\s+FUNCTION\s+\w+\(\)\s*;/gi
  while ((match = createTriggerRegex.exec(sql)) !== null) {
    statements.push(match[0])
  }

  return statements
}

main().catch((err) => {
  console.error("Setup failed:", err)
  process.exit(1)
})
