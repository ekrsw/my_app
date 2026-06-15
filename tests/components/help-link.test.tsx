// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { HelpLink } from "@/components/help/help-link"

describe("HelpLink", () => {
  it("/top/help#<anchor> へのリンクを生成する", () => {
    render(<HelpLink anchor="history" />)
    const link = screen.getByRole("link", { name: "ヘルプ" })
    expect(link).toHaveAttribute("href", "/top/help#history")
  })

  it("aria-label でヘルプとして認識できる", () => {
    render(<HelpLink anchor="duty-types" />)
    expect(screen.getByLabelText("ヘルプ")).toBeInTheDocument()
  })
})
