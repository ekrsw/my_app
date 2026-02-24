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

  const initSqlPath = path.resolve(
    __dirname,
    "../prisma/migrations/0_init/migration.sql"
  )
  const initSql = readFileSync(initSqlPath, "utf-8")

  // Clean up removed triggers/functions (e.g. employee_name_history)
  await testClient.query(`DROP TRIGGER IF EXISTS trg_employee_name_change ON employees`)
  await testClient.query(`DROP FUNCTION IF EXISTS record_employee_name_change()`)
  console.log("  Cleaned up removed triggers")

  const migrationFiles = [
    "0_init/migration.sql",
    "20260222100000_employee_group_junction/migration.sql",
    "20260225100000_add_shift_codes/migration.sql",
    "20260225110000_add_shift_code_defaults_trigger/migration.sql",
    "20260225120000_remove_shift_codes_label/migration.sql",
  ]

  for (const file of migrationFiles) {
    const filePath = path.resolve(__dirname, "../prisma/migrations", file)
    const sql = readFileSync(filePath, "utf-8")
    const stmts = extractTriggerStatements(sql)
    for (const stmt of stmts) {
      try {
        await testClient.query(stmt)
      } catch (err: unknown) {
        const pgErr = err as { code?: string }
        if (pgErr.code !== "42710") {
          console.error(`Error applying trigger SQL from ${file}:`, err)
        }
      }
    }
    if (stmts.length > 0) {
      console.log(`  Applied triggers from ${file}`)
    }
  }

  // Apply partial unique indexes
  const indexRegex =
    /CREATE\s+UNIQUE\s+INDEX[\s\S]*?;/gi
  let indexMatch
  while ((indexMatch = indexRegex.exec(initSql)) !== null) {
    // Only apply partial unique indexes (WHERE clause)
    if (indexMatch[0].includes("WHERE")) {
      try {
        await testClient.query(indexMatch[0])
      } catch {
        // Ignore if already exists
      }
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

  // Extract ALTER TABLE statements
  const alterTableRegex = /ALTER\s+TABLE\s+[^;]+;/gi
  while ((match = alterTableRegex.exec(sql)) !== null) {
    statements.push(match[0])
  }

  return statements
}

main().catch((err) => {
  console.error("Setup failed:", err)
  process.exit(1)
})
