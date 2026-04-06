/**
 * キャパシティ計算ユーティリティ
 * ダッシュボードの「対応可能人数」表示で使用する純粋関数群
 */

/** ISO文字列 or Date から "HH:mm" を抽出 */
export function getTimeHHMM(d: Date | string): string {
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}

/** 現在のJST日付を "YYYY-MM-DD" で返す */
function getTodayJSTDateStr(): string {
  const now = new Date()
  const jstMs = now.getTime() + 9 * 60 * 60 * 1000
  const jst = new Date(jstMs)
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`
}

/** Date または ISO 文字列から "YYYY-MM-DD" を抽出 */
function toDateStr(d: Date | string): string {
  if (d instanceof Date) return d.toISOString().substring(0, 10)
  return String(d).substring(0, 10)
}

/** ロール割り当ての startDate/endDate が今日を含む有効期間内かを判定 */
function isRoleActiveToday(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  todayStr: string
): boolean {
  if (startDate) {
    if (toDateStr(startDate) > todayStr) return false
  }
  if (endDate) {
    if (toDateStr(endDate) < todayStr) return false
  }
  return true
}

/** 現在のJST時刻を "HH:mm" で返す */
export function getCurrentJSTTimeHHMM(): string {
  const now = new Date()
  const jstHours = (now.getUTCHours() + 9) % 24
  const minutes = now.getUTCMinutes()
  return `${String(jstHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * 時刻が start〜end の範囲内かを判定（深夜跨ぎ対応）
 * end < start の場合は日跨ぎとみなす（例: 22:00〜08:00）
 */
export function isTimeInRange(start: string, end: string, now: string): boolean {
  if (start <= end) {
    // 通常: 09:00〜17:00
    return start <= now && now <= end
  }
  // 深夜跨ぎ: 22:00〜08:00 → 22:00以降 or 08:00以前
  return now >= start || now <= end
}

/** 当番が現在アクティブかどうかを判定（深夜跨ぎ対応） */
export function isDutyActive(
  startTime: Date | string,
  endTime: Date | string,
  now: string
): boolean {
  return isTimeInRange(getTimeHHMM(startTime), getTimeHHMM(endTime), now)
}

/** シフトの出勤・退勤時刻から現在出勤中かどうかを判定（深夜跨ぎ対応） */
export function isWorkerPresent(
  startTime: Date | string | null,
  endTime: Date | string | null,
  now: string
): boolean {
  if (!startTime) return false
  const start = getTimeHHMM(startTime)
  if (!endTime) return start <= now
  return isTimeInRange(start, getTimeHHMM(endTime), now)
}

/** キャパシティを計算。出勤中・当番中ともにリアルタイム判定。reducesCapacity=false の当番は控除しない */
export function calculateCapacity(
  shifts: Array<{ employeeId: string | null; startTime: Date | string | null; endTime: Date | string | null }>,
  duties: DutyInput[],
  currentTime: string
): { total: number; onDuty: number; available: number } {
  const presentEmployeeIds = new Set<string>()
  for (const shift of shifts) {
    if (shift.employeeId && isWorkerPresent(shift.startTime, shift.endTime, currentTime)) {
      presentEmployeeIds.add(shift.employeeId)
    }
  }
  const total = presentEmployeeIds.size

  const onDutyEmployeeIds = new Set<string>()
  for (const duty of duties) {
    if (duty.reducesCapacity && presentEmployeeIds.has(duty.employeeId) && isDutyActive(duty.startTime, duty.endTime, currentTime)) {
      onDutyEmployeeIds.add(duty.employeeId)
    }
  }
  const onDuty = onDutyEmployeeIds.size

  return {
    total,
    onDuty,
    available: Math.max(0, total - onDuty),
  }
}

/** 対応可能人数に応じた色を返す */
export function getCapacityColor(available: number): "green" | "yellow" | "red" {
  if (available >= 3) return "green"
  if (available >= 1) return "yellow"
  return "red"
}

export type ShiftWithDetails = {
  employeeId: string | null
  startTime: Date | string | null
  endTime: Date | string | null
  groups: Array<{ id: number; name: string }>
  roles: Array<{ roleType: string; roleName: string; startDate?: Date | string | null; endDate?: Date | string | null }>
}

export type DutyInput = {
  employeeId: string
  startTime: Date | string
  endTime: Date | string
  reducesCapacity: boolean
}

export type CapacityFilter = {
  groupIds?: number[]
  roleNames?: Record<string, string[]>  // roleType -> roleName[]
}

/** 出勤中の従業員をフィルター条件で絞り込んでキャパシティを計算 */
export function calculateFilteredCapacity(
  shifts: ShiftWithDetails[],
  duties: DutyInput[],
  currentTime: string,
  filter?: CapacityFilter,
  svRoleName?: string
): { total: number; onDuty: number; available: number; svTotal: number; svAvailable: number } {
  // 出勤中の従業員を特定
  const presentEmployees: Array<{ id: string; groups: Array<{ id: number }>; roles: ShiftWithDetails["roles"] }> = []
  const seen = new Set<string>()
  for (const shift of shifts) {
    if (shift.employeeId && !seen.has(shift.employeeId) && isWorkerPresent(shift.startTime, shift.endTime, currentTime)) {
      seen.add(shift.employeeId)
      presentEmployees.push({ id: shift.employeeId, groups: shift.groups, roles: shift.roles })
    }
  }

  // フィルター適用
  let filtered = presentEmployees
  if (filter?.groupIds && filter.groupIds.length > 0) {
    const gids = new Set(filter.groupIds)
    filtered = filtered.filter((e) => e.groups.some((g) => gids.has(g.id)))
  }
  if (filter?.roleNames) {
    for (const [roleType, names] of Object.entries(filter.roleNames)) {
      if (names.length > 0) {
        const nameSet = new Set(names)
        filtered = filtered.filter((e) =>
          e.roles.some((r) => r.roleType === roleType && nameSet.has(r.roleName))
        )
      }
    }
  }

  const filteredIds = new Set(filtered.map((e) => e.id))
  const total = filteredIds.size

  // 当番中（reducesCapacity=true のもののみ控除）
  const onDutyIds = new Set<string>()
  for (const duty of duties) {
    if (duty.reducesCapacity && filteredIds.has(duty.employeeId) && isDutyActive(duty.startTime, duty.endTime, currentTime)) {
      onDutyIds.add(duty.employeeId)
    }
  }
  const onDuty = onDutyIds.size

  // SV人数カウント（filteredIds の中でSVロールを持ち、かつ今日が有効期間内の従業員）
  let svTotal = 0
  let svAvailable = 0
  if (svRoleName) {
    const todayStr = getTodayJSTDateStr()
    for (const e of filtered) {
      const isSV = e.roles.some(
        (r) => r.roleName === svRoleName && isRoleActiveToday(r.startDate, r.endDate, todayStr)
      )
      if (isSV) {
        svTotal++
        if (!onDutyIds.has(e.id)) svAvailable++
      }
    }
  }

  return { total, onDuty, available: Math.max(0, total - onDuty), svTotal, svAvailable }
}

/** 出勤中の従業員から、フィルター選択肢（グループ・ロール）を抽出 */
export function extractFilterOptions(
  shifts: ShiftWithDetails[],
  currentTime: string
): { groups: Array<{ id: number; name: string }>; roles: Record<string, string[]> } {
  const groupMap = new Map<number, string>()
  const roleMap = new Map<string, Set<string>>()  // roleType -> Set<roleName>
  const seen = new Set<string>()

  for (const shift of shifts) {
    if (shift.employeeId && !seen.has(shift.employeeId) && isWorkerPresent(shift.startTime, shift.endTime, currentTime)) {
      seen.add(shift.employeeId)
      for (const g of shift.groups) {
        groupMap.set(g.id, g.name)
      }
      for (const r of shift.roles) {
        if (!roleMap.has(r.roleType)) roleMap.set(r.roleType, new Set())
        roleMap.get(r.roleType)!.add(r.roleName)
      }
    }
  }

  const groups = Array.from(groupMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"))

  const roles: Record<string, string[]> = {}
  for (const [type, names] of roleMap) {
    roles[type] = Array.from(names).sort((a, b) => a.localeCompare(b, "ja"))
  }

  return { groups, roles }
}
