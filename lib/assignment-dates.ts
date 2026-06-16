import type { Prisma } from "@/app/generated/prisma/client"

/**
 * 所属(employee_groups) / 機能ロール(employee_function_roles) / 役職(employee_positions)
 * の開始日・終了日を、従業員の入社日(hireDate)・退職日(terminationDate)から自動補完する
 * 純ロジック。設計: ~/.gstack/projects/ekrsw-my_app/ekoresawa-main-design-20260616-171556.md
 *
 * 補完は常に「空欄(null)のときだけ」。手入力済みの日付は上書きしない。
 */

/**
 * 作成時補完: 開始日が未指定なら入社日を採用する。
 * 入力は呼び出し側でパース済みの Date | null（文字列パースはここでは行わない。
 * `new Date("yyyy-mm-dd")` の UTC 解釈は date-utils の方針に委ねる）。
 *
 * - 明示的な開始日があればそれを優先（= 上書きしない）
 * - 無ければ入社日。入社日も無ければ null のまま
 * - 入社日で埋めると 入社日 > 終了日 になる場合は埋めない（null のまま）。
 *   役職の no_overlap(daterange) 反転例外を作成経路でも避ける。遡及補完のガードと対称。
 */
export function resolveStartDate(
  startDate: Date | null,
  hireDate: Date | null,
  endDate: Date | null = null,
): Date | null {
  if (startDate) return startDate
  if (hireDate && (endDate === null || hireDate.getTime() <= endDate.getTime())) {
    return hireDate
  }
  return null
}

/**
 * 遡及補完(入社日): 指定従業員の所属/ロール/役職のうち「開始日が空欄」の
 * レコードへ入社日を補完する。
 *
 * 範囲反転ガード(重要): 終了日 < 入社日 のレコードはスキップする。
 * employee_positions_no_overlap は daterange(start, COALESCE(end,'9999-12-31')) の
 * EXCLUDE 制約で、start に hireDate を入れると下限 > 上限となり PostgreSQL が
 * 「range lower bound must be less than or equal to range upper bound」例外を投げ、
 * トランザクション全体が落ちる。よって `endDate IS NULL OR endDate >= hireDate` に限定。
 *
 *   補完前: [ (null) ──────────────► end ]
 *   補完後: [ hire   ──────────────► end ]   (hire <= end のときのみ)
 *
 * NULL→値 は範囲を内側へ縮めるだけなので、既存レコードと新たに重複することはない。
 */
export async function fillBlankStartDates(
  tx: Prisma.TransactionClient,
  employeeId: string,
  hireDate: Date,
): Promise<void> {
  const where = {
    employeeId,
    startDate: null,
    OR: [{ endDate: null }, { endDate: { gte: hireDate } }],
  }
  const data = { startDate: hireDate }
  await tx.employeeGroup.updateMany({ where, data })
  await tx.employeeFunctionRole.updateMany({ where, data })
  await tx.employeePosition.updateMany({ where, data })
}

/**
 * 遡及補完(退職日): 指定従業員の所属/ロール/役職のうち「終了日が空欄」の
 * レコードへ退職日を補完する。
 *
 * 範囲ガード: 開始日 > 退職日 のレコードはスキップ（不正範囲・no_overlap 制約違反の回避）。
 * → `startDate IS NULL OR startDate <= terminationDate`
 *
 * end を null(=上限 9999) から有限の退職日へ補完するのも範囲を縮める方向なので、
 * 既存レコードと新たに重複しない（start 補完と対称）。
 */
export async function fillBlankEndDates(
  tx: Prisma.TransactionClient,
  employeeId: string,
  terminationDate: Date,
): Promise<void> {
  const where = {
    employeeId,
    endDate: null,
    OR: [{ startDate: null }, { startDate: { lte: terminationDate } }],
  }
  const data = { endDate: terminationDate }
  await tx.employeeGroup.updateMany({ where, data })
  await tx.employeeFunctionRole.updateMany({ where, data })
  await tx.employeePosition.updateMany({ where, data })
}

/**
 * 遡及補完のオーケストレーション。入社日/退職日が NULL→値 に変わったときだけ、
 * start補完 → end補完 の順で実行する。start を先に埋めることで、同一更新で
 * 入社日・退職日を両方設定し かつ 入社日 > 退職日 のケースでも end補完側の
 * `startDate <= terminationDate` ガードが効き、範囲反転を防げる。
 *
 * updateEmployee / updateEmployeeWithRoles / importEmployees の3経路で共用し、
 * 「NULL→値 のときだけ」「start→end の順」という不変条件を一箇所に集約する。
 */
export async function fillRetroactiveDates(
  tx: Prisma.TransactionClient,
  employeeId: string,
  opts: {
    hadHireDate: boolean
    newHireDate: Date | null
    hadTerminationDate: boolean
    newTerminationDate: Date | null
  },
): Promise<void> {
  if (opts.newHireDate && !opts.hadHireDate) {
    await fillBlankStartDates(tx, employeeId, opts.newHireDate)
  }
  if (opts.newTerminationDate && !opts.hadTerminationDate) {
    await fillBlankEndDates(tx, employeeId, opts.newTerminationDate)
  }
}

/**
 * 作成時補完: 従業員の入社日を取得し resolveStartDate を適用する共通処理。
 * 個別 add 経路（addEmployeeGroup / assignRole / addEmployeePosition）で共用。
 * client は PrismaClient / トランザクションクライアントのどちらでもよい。
 */
export async function resolveStartDateForEmployee(
  client: Prisma.TransactionClient,
  employeeId: string,
  inputStartDate: Date | null,
  endDate: Date | null = null,
): Promise<Date | null> {
  const employee = await client.employee.findUnique({
    where: { id: employeeId },
    select: { hireDate: true },
  })
  return resolveStartDate(inputStartDate, employee?.hireDate ?? null, endDate)
}
