import { vi } from "vitest"

export function mockAuth(authenticated = true) {
  vi.mock("@/auth", () => ({
    auth: vi.fn().mockResolvedValue(
      authenticated
        ? { user: { id: "1", name: "admin" } }
        : null
    ),
  }))
}
