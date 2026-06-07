import { describe, it, expect } from "vitest"
import { existsSync } from "node:fs"
import path from "node:path"
import { HELP_SECTIONS } from "@/lib/help/sections"

/**
 * マニフェスト整合性テスト。
 * HELP_SECTIONS の file 名と実 .md がズレる（リネーム漏れ）と /help のビルドが
 * 壊れるため、ここで早期に検知する。
 */
describe("HELP_SECTIONS マニフェスト", () => {
  it("5 セクションある", () => {
    expect(HELP_SECTIONS).toHaveLength(5)
  })

  it("anchor が一意である", () => {
    const anchors = HELP_SECTIONS.map((s) => s.anchor)
    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it("各セクションに title がある", () => {
    for (const section of HELP_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0)
    }
  })

  it("各 file が content/help/ に実在する", () => {
    for (const section of HELP_SECTIONS) {
      const fullPath = path.join(process.cwd(), "content", "help", section.file)
      expect(existsSync(fullPath), `${section.file} が存在しません`).toBe(true)
    }
  })
})
