import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isWeekend,
  addMonths,
  subMonths,
  isSameMonth,
} from "date-fns"
import { ja } from "date-fns/locale"

export {
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isWeekend,
  addMonths,
  subMonths,
  isSameMonth,
}

/**
 * PostgreSQL (timezone=Asia/Tokyo) の timestamp without time zone は
 * JST の値をそのまま格納するが、Prisma はこれを UTC として読み込む。
 * date-fns の format はローカルタイムで表示するため、二重に JST オフセットが
 * 適用されてしまう。この関数で UTC の各成分をローカル Date に移し替えることで、
 * format がそのまま DB の値（=実際の JST 値）を出力するようにする。
 */
function asUTC(d: Date): Date {
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()
  )
}

export function formatDate(date: Date | string | null, pattern = "yyyy/MM/dd"): string {
  if (!date) return "-"
  const d = typeof date === "string" ? parseISO(date) : date
  return format(asUTC(d), pattern, { locale: ja })
}

export function formatTime(time: Date | string | null): string {
  if (!time) return "-"
  const d = typeof time === "string" ? parseISO(time) : time
  return format(asUTC(d), "HH:mm")
}

export function formatMonth(date: Date): string {
  return format(date, "yyyy年M月", { locale: ja })
}

export function formatDateShort(date: Date): string {
  return format(date, "M/d(E)", { locale: ja })
}

export function getDaysInMonth(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(start)
  return eachDayOfInterval({ start, end })
}

export function getDayOfWeekJa(date: Date): string {
  return format(date, "E", { locale: ja })
}

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  if (isNaN(d.getTime())) return ""
  return d.toISOString().split("T")[0]
}
