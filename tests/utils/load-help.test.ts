import { describe, it, expect } from "vitest"
import { loadHelpSection } from "@/lib/help/load-help"

describe("loadHelpSection", () => {
  it("実在する .md を読み込んで文字列を返す", async () => {
    const md = await loadHelpSection("duty-types.md")
    expect(typeof md).toBe("string")
    expect(md.length).toBeGreaterThan(0)
    // content/help/duty-types.md の既知の語を含む
    expect(md).toContain("業務種別")
  })

  it("存在しないファイルでは throw する（fail-loud）", async () => {
    await expect(loadHelpSection("does-not-exist.md")).rejects.toThrow()
  })
})
