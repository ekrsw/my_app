// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"

// --- モック ---

// next/server（next-auth が内部で参照）
vi.mock("next/server", () => ({
  NextResponse: { json: vi.fn(), redirect: vi.fn() },
  NextRequest: vi.fn(),
}))

// next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/duties",
}))

// DutyAssignmentForm — open prop をテスト検証用に公開
vi.mock("@/components/duty-assignments/duty-assignment-form", () => ({
  DutyAssignmentForm: ({ open }: { open: boolean }) => (
    open ? <div data-testid="duty-form-dialog">ダイアログ</div> : null
  ),
}))

// 子コンポーネントで不要なものを軽量モックに置き換え
vi.mock("@/components/duty-assignments/duty-view-mode-select", () => ({
  DutyViewModeSelect: () => <div data-testid="view-mode-select" />,
}))

vi.mock("@/components/duty-assignments/duty-type-summary-row", () => ({
  DutyTypeSummaryRow: () => <div data-testid="duty-type-summary" />,
}))

vi.mock("@/components/duty-assignments/filter-preset-manager", () => ({
  FilterPresetManager: () => null,
}))

import { DutyAssignmentPageClient } from "@/components/duty-assignments/duty-assignment-page-client"

const BASE_PROPS = {
  viewMode: "monthly" as const,
  dailyData: [],
  dailyTotal: 0,
  dailyHasMore: false,
  dailyNextCursor: null,
  dailyDate: "2026-04-08",
  filterOptions: { employees: [], groups: [], dutyTypes: [] },
  employeeIds: [],
  groupIds: [],
  dutyTypeIds: [],
  reducesCapacity: null,
  sortBy: "startTime" as const,
  sortOrder: "asc" as const,
  calendarData: [
    {
      employeeId: "emp-1",
      employeeName: "テスト太郎",
      duties: {},
    },
  ],
  dutyTypeSummary: [],
  year: 2026,
  month: 4,
  monthlyEmployeeIds: [],
  employeeOptions: [],
  dutyTypeOptions: [],
}

describe("月次カレンダー セルクリック認証ガード", () => {
  it("未ログイン時はセルクリックでダイアログが表示されない", async () => {
    const user = userEvent.setup()

    render(
      <DutyAssignmentPageClient {...BASE_PROPS} isAuthenticated={false} />
    )

    // セルをクリック（「-」が表示されている空セル）
    const cells = screen.getAllByRole("button", { name: /の業務割当を追加/ })
    expect(cells.length).toBeGreaterThan(0)
    await user.click(cells[0])

    // ダイアログが表示されないことを確認
    expect(screen.queryByTestId("duty-form-dialog")).not.toBeInTheDocument()
  })

  it("ログイン時はセルクリックでダイアログが表示される", async () => {
    const user = userEvent.setup()

    render(
      <DutyAssignmentPageClient {...BASE_PROPS} isAuthenticated={true} />
    )

    const cells = screen.getAllByRole("button", { name: /の業務割当を追加/ })
    expect(cells.length).toBeGreaterThan(0)
    await user.click(cells[0])

    // ダイアログが表示されることを確認
    expect(screen.getByTestId("duty-form-dialog")).toBeInTheDocument()
  })
})
