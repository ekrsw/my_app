// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { SealedNotice } from "@/components/crypto/sealed-notice"

describe("SealedNotice", () => {
  it("既定の説明文と「ロック中」見出しを表示する", () => {
    render(<SealedNotice />)
    expect(screen.getByText(/ロック中/)).toBeInTheDocument()
    expect(screen.getByText(/管理者によるアンロックが必要/)).toBeInTheDocument()
  })

  it("description で説明文を上書きできる", () => {
    render(<SealedNotice description="カスタム説明文です" />)
    expect(screen.getByText("カスタム説明文です")).toBeInTheDocument()
  })
})
