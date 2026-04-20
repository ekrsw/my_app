// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeAll } from "vitest"

// Radix Select が happy-dom で参照する pointer capture 系 API の軽量 polyfill
beforeAll(() => {
  if (!(Element.prototype as unknown as { hasPointerCapture?: unknown }).hasPointerCapture) {
    Object.defineProperty(Element.prototype, "hasPointerCapture", {
      value: () => false,
      configurable: true,
    })
  }
  if (!(Element.prototype as unknown as { releasePointerCapture?: unknown }).releasePointerCapture) {
    Object.defineProperty(Element.prototype, "releasePointerCapture", {
      value: () => {},
      configurable: true,
    })
  }
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: () => {},
      configurable: true,
    })
  }
})

// Server Actions をモック（実行させない）
vi.mock("@/lib/actions/duty-assignment-actions", () => ({
  createDutyAssignment: vi.fn().mockResolvedValue({}),
  updateDutyAssignment: vi.fn().mockResolvedValue({}),
  deleteDutyAssignment: vi.fn().mockResolvedValue({}),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { DutyAssignmentForm } from "@/components/duty-assignments/duty-assignment-form"

const EMPLOYEES = [{ id: "emp-1", name: "テスト太郎" }]

const DUTY_TYPES = [
  {
    id: 1,
    name: "朝番",
    defaultReducesCapacity: true,
    defaultStartTime: "09:00",
    defaultEndTime: "17:00",
    defaultNote: "朝番デフォルト備考",
    defaultTitle: "朝番デフォルトタイトル",
  },
  {
    id: 2,
    name: "遅番",
    defaultReducesCapacity: false,
    defaultStartTime: "13:00",
    defaultEndTime: "21:00",
    defaultNote: "遅番デフォルト備考",
    defaultTitle: "遅番デフォルトタイトル",
  },
  {
    id: 3,
    name: "空デフォルト",
    defaultReducesCapacity: true,
    defaultStartTime: null,
    defaultEndTime: null,
    defaultNote: null,
    defaultTitle: null,
  },
]

function renderForm() {
  return render(
    <DutyAssignmentForm
      employees={EMPLOYEES}
      dutyTypes={DUTY_TYPES}
      open={true}
      onOpenChange={() => {}}
    />
  )
}

// Radix Select の「業務種別」トリガーはフォーム内 combobox のうち2番目
// (1番目は従業員 Popover ボタン)
async function selectDutyType(
  user: ReturnType<typeof userEvent.setup>,
  optionName: string
) {
  const comboboxes = screen.getAllByRole("combobox")
  const dutyTypeTrigger = comboboxes[1]
  await user.click(dutyTypeTrigger)
  const option = await screen.findByRole("option", { name: optionName })
  await user.click(option)
}

describe("DutyAssignmentForm - 業務種別選択時のフィールド保護", () => {
  it("初回選択: 空のフィールドにデフォルト値が反映される", async () => {
    const user = userEvent.setup()
    renderForm()

    await selectDutyType(user, "朝番")

    expect(screen.getByLabelText("タイトル")).toHaveValue("朝番デフォルトタイトル")
    expect(screen.getByLabelText(/開始時刻/)).toHaveValue("09:00")
    expect(screen.getByLabelText(/終了時刻/)).toHaveValue("17:00")
    expect(screen.getByLabelText("備考")).toHaveValue("朝番デフォルト備考")
  })

  it("【リグレッション】タイトル入力済み → 業務種別選択でタイトル保持", async () => {
    const user = userEvent.setup()
    renderForm()

    const titleInput = screen.getByLabelText("タイトル")
    await user.type(titleInput, "ユーザー入力タイトル")

    await selectDutyType(user, "朝番")

    expect(titleInput).toHaveValue("ユーザー入力タイトル")
    // 他の空フィールドにはデフォルトが入る
    expect(screen.getByLabelText(/開始時刻/)).toHaveValue("09:00")
  })

  it("【リグレッション】開始/終了時刻入力済み → 業務種別選択で時刻保持", async () => {
    const user = userEvent.setup()
    renderForm()

    const startInput = screen.getByLabelText(/開始時刻/) as HTMLInputElement
    const endInput = screen.getByLabelText(/終了時刻/) as HTMLInputElement
    await user.type(startInput, "10:30")
    await user.type(endInput, "18:30")

    await selectDutyType(user, "朝番")

    expect(startInput).toHaveValue("10:30")
    expect(endInput).toHaveValue("18:30")
    // 空だったタイトル・備考にはデフォルトが入る
    expect(screen.getByLabelText("タイトル")).toHaveValue("朝番デフォルトタイトル")
  })

  it("【リグレッション】備考入力済み → 業務種別選択で備考保持", async () => {
    const user = userEvent.setup()
    renderForm()

    const noteInput = screen.getByLabelText("備考")
    await user.type(noteInput, "ユーザー備考")

    await selectDutyType(user, "朝番")

    expect(noteInput).toHaveValue("ユーザー備考")
  })

  it("reducesCapacity は初回選択時のみデフォルト適用、以降はユーザー設定を保持", async () => {
    const user = userEvent.setup()
    renderForm()

    const checkbox = screen.getByLabelText(/対応可能人員から控除する/) as HTMLButtonElement

    // 初期値は true
    expect(checkbox).toHaveAttribute("data-state", "checked")

    // 初回: 朝番 (defaultReducesCapacity: true) → checked のまま
    await selectDutyType(user, "朝番")
    expect(checkbox).toHaveAttribute("data-state", "checked")

    // ユーザーが OFF
    await user.click(checkbox)
    expect(checkbox).toHaveAttribute("data-state", "unchecked")

    // 2回目: 遅番 (defaultReducesCapacity: false) → ユーザー設定(OFF)を保持
    await selectDutyType(user, "遅番")
    expect(checkbox).toHaveAttribute("data-state", "unchecked")
  })

  it("デフォルト値が null の業務種別 → フィールドは空のまま", async () => {
    const user = userEvent.setup()
    renderForm()

    await selectDutyType(user, "空デフォルト")

    expect(screen.getByLabelText("タイトル")).toHaveValue("")
    expect(screen.getByLabelText(/開始時刻/)).toHaveValue("")
    expect(screen.getByLabelText(/終了時刻/)).toHaveValue("")
    expect(screen.getByLabelText("備考")).toHaveValue("")
  })

  it("業務種別を切り替え: 入力済みフィールドは保持、空フィールドのみデフォルト適用", async () => {
    const user = userEvent.setup()
    renderForm()

    // 1回目: 朝番 → 全フィールドに朝番デフォルト
    await selectDutyType(user, "朝番")
    expect(screen.getByLabelText("タイトル")).toHaveValue("朝番デフォルトタイトル")

    // タイトルのみクリア → 遅番に切替
    const titleInput = screen.getByLabelText("タイトル")
    await user.clear(titleInput)
    await selectDutyType(user, "遅番")

    // タイトルは空だったので遅番デフォルトが入る
    expect(titleInput).toHaveValue("遅番デフォルトタイトル")
    // 時刻・備考は朝番の値が保持される
    expect(screen.getByLabelText(/開始時刻/)).toHaveValue("09:00")
    expect(screen.getByLabelText(/終了時刻/)).toHaveValue("17:00")
    expect(screen.getByLabelText("備考")).toHaveValue("朝番デフォルト備考")
  })

  it("半角スペースのみの入力は空扱い (.trim() 判定) でデフォルトが適用される", async () => {
    const user = userEvent.setup()
    renderForm()

    const titleInput = screen.getByLabelText("タイトル")
    await user.type(titleInput, "   ")

    await selectDutyType(user, "朝番")

    expect(titleInput).toHaveValue("朝番デフォルトタイトル")
  })
})
