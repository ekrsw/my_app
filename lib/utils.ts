import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(d: Date | string | null): string {
  if (!d) return "-"
  const iso = typeof d === "string" ? d : d.toISOString()
  return iso.substring(11, 16)
}
