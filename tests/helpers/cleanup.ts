import { prisma } from "./prisma"

/**
 * Truncate all tables using CASCADE.
 * Call this in beforeEach to ensure test isolation.
 */
export async function cleanupDatabase() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      employee_external_accounts,
      employee_function_roles,
      employee_name_history,
      employee_group_history,
      shift_change_history,
      shifts,
      employees,
      groups,
      function_roles,
      external_tools
    CASCADE
  `)
}
