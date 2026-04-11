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

// DutyCellDialog — 認証ガードの振る舞いを再現するモック
vi.mock("@/components/duty-assignments/duty-cell-dialog", () => ({
  DutyCellDialog: ({
    open,
    isAuthenticated,
    onAddNew,
    dateStr,
    employeeId,
  }: {
    open: boolean
    isAuthenticated: boolean
    onAddNew: (dateStr: string, employeeId: string) => void
    dateStr: string
    employeeId: string
  }) =>
    open ? (
      <div data-testid="cell-dialog">
        {isAuthenticated && (
          <button
            onClick={() => onAddNew(dateStr, employeeId)}
            data-testid="dialog-add-btn"
          >
            新規追加
          </button>
        )}
      </div>
    ) : null,
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

vi.mock("@/components/shifts/shift-detail-dialog", () => ({
  ShiftDetailDialog: () => null,
}))

vi.mock("@/components/shifts/shift-form", () => ({
  ShiftForm: () => null,
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
  shiftDataMap: {},
  shiftCodes: [],
  shiftIdsWithHistory: [],
  shiftLatestHistory: {},
  groups: [],
  roles: [],
  employeeOptions: [],
  dutyTypeOptions: [],
}

describe("月次カレンダー セルクリック認証ガード", () => {
  it("未ログイン時はDialog内に新規追加ボタンが表示されない", async () => {
    const user = userEvent.setup()
    render(
      <DutyAssignmentPageClient {...BASE_PROPS} isAuthenticated={false} />
    )

    // 下段（業務エリア）をクリックしてDialogを開く
    const dutyCells = document.querySelectorAll("[class*='flex-\\[4\\]']")
    if (dutyCells.length > 0) {
      await user.click(dutyCells[0] as HTMLElement)
    }

    // Dialog内に新規追加ボタンは非表示
    expect(screen.queryByTestId("dialog-add-btn")).not.toBeInTheDocument()
  })

  it("ログイン時はセルクリック→Dialog内の新規追加ボタンでフォームが表示される", async () => {
    const user = userEvent.setup()

    render(
      <DutyAssignmentPageClient {...BASE_PROPS} isAuthenticated={true} />
    )

    // 下段（業務エリア）をクリックしてDialogを開く
    const dutyCells = document.querySelectorAll("[class*='flex-\\[4\\]']")
    expect(dutyCells.length).toBeGreaterThan(0)
    await user.click(dutyCells[0] as HTMLElement)

    // Dialog内の新規追加ボタンをクリック
    const addBtn = screen.getByTestId("dialog-add-btn")
    expect(addBtn).toBeInTheDocument()
    await user.click(addBtn)

    // フォームダイアログが表示されること
    expect(screen.getByTestId("duty-form-dialog")).toBeInTheDocument()
  })
})
