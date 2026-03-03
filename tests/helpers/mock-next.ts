import { vi } from "vitest"

/**
 * Mock next/cache revalidatePath.
 * Must be called at the top level of test files that test server actions.
 */
export function mockNextCache() {
  vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
  }))
}
