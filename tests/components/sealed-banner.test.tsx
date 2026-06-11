// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/crypto/keyring", () => ({ isUnlocked: vi.fn() }))
import { isUnlocked } from "@/lib/crypto/keyring"
import { SealedBanner } from "@/components/crypto/sealed-banner"

describe("SealedBanner", () => {
  it("unlocked のときは何も表示しない", () => {
    vi.mocked(isUnlocked).mockReturnValue(true)
    const { container } = render(<SealedBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it("sealed のときはロック中の警告を表示する", () => {
    vi.mocked(isUnlocked).mockReturnValue(false)
    render(<SealedBanner />)
    expect(screen.getByText(/ロック中/)).toBeInTheDocument()
  })
})
