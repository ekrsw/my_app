// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { HelpSection } from "@/components/help/help-section"

const SAMPLE_MD = `本文の段落です。

## 手順

1. 最初のステップ
2. 次のステップ

| 項目 | 内容 |
| --- | --- |
| 日付 | 2026-05-31 |
`

describe("HelpSection", () => {
  it("section に anchor の id が付く", () => {
    const { container } = render(
      <HelpSection anchor="duty-types" title="業務種別の追加" markdown={SAMPLE_MD} />
    )
    expect(container.querySelector("section#duty-types")).not.toBeNull()
  })

  it("manifest の title が見出しとして描画される", () => {
    render(
      <HelpSection anchor="duty-types" title="業務種別の追加" markdown={SAMPLE_MD} />
    )
    expect(
      screen.getByRole("heading", { name: "業務種別の追加" })
    ).toBeInTheDocument()
  })

  it("GFM のリストと表が描画される", () => {
    render(
      <HelpSection anchor="history" title="変更履歴の操作" markdown={SAMPLE_MD} />
    )
    expect(screen.getByText("最初のステップ")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByText("2026-05-31")).toBeInTheDocument()
  })
})
