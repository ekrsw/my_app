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
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/duties",
}))

// DutyAssignmentForm — open prop をテスト検証用に公開
vi.mock("@/components/duty-assignments/duty-assignment-form", () => ({
  DutyAssignmentForm: ({ open }: { open: boolean }) => (
    open ? <div data-testid="duty-form-dialog">ダイアログ</div> : null
  ),
}))

// DutyCellPopover — 認証ガードの振る舞いを再現するモック
vi.mock("@/components/duty-assignments/duty-cell-popover", () => ({
  DutyCellPopover: ({
    isAuthenticated,
    onAddNew,
    dateStr,
    employeeId,
    children,
  }: {
    isAuthenticated: boolean
    onAddNew: (dateStr: string, employeeId: string) => void
    dateStr: string
    employeeId: string
    children: React.ReactNode
  }) => (
    <div data-testid="cell-popover">
      {children}
      {isAuthenticated && (
        <button
          onClick={() => onAddNew(dateStr, employeeId)}
          data-testid="popover-add-btn"
        >
          新規追加
        </button>
      )}
    </div>
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
      groupName: null,
      duties: {},
    },
  ],
  dutyTypeSummary: [],
  calendarTotal: 1,
  calendarHasMore: false,
  calendarNextCursor: null,
  year: 2026,
  month: 4,
  monthlyEmployeeIds: [],
  monthlyGroupIds: [],
  monthlyUnassigned: false,
  monthlyRoleIds: [],
  monthlyRoleUnassigned: false,
  monthlyDutyTypeIds: [],
  monthlyDutyUnassigned: false,
  shiftCodeMap: {},
  shiftCodeInfoMap: {},
  groups: [],
  roles: [],
  employeeOptions: [],
  dutyTypeOptions: [],
}

describe("月次カレンダー セルクリック認証ガード", () => {
  it("未ログイン時はPopover内に新規追加ボタンが表示されない", () => {
    render(
      <DutyAssignmentPageClient {...BASE_PROPS} isAuthenticated={false} />
    )

    // Popoverモックは表示されるが、新規追加ボタンは非表示
    expect(screen.queryByTestId("popover-add-btn")).not.toBeInTheDocument()
  })

  it("ログイン時はPopover内の新規追加ボタンでダイアログが表示される", async () => {
    const user = userEvent.setup()

    render(
      <DutyAssignmentPageClient {...BASE_PROPS} isAuthenticated={true} />
    )

    // 新規追加ボタンが表示されること
    const addBtns = screen.getAllByTestId("popover-add-btn")
    expect(addBtns.length).toBeGreaterThan(0)
    await user.click(addBtns[0])

    // フォームダイアログが表示されること
    expect(screen.getByTestId("duty-form-dialog")).toBeInTheDocument()
  })
})
