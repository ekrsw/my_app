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
      employee_groups,
      employee_positions,
      employee_group_history,
      employee_function_role_history,
      employee_position_history,
      shift_change_history,
      shifts,
      employees,
      groups,
      function_roles,
      external_tools,
      positions,
      shift_codes
    CASCADE
  `)
}
