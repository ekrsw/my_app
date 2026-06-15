import { redirect } from "next/navigation"
import type { SearchParams } from "@/types"
import { ROUTES } from "@/lib/routes"

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab") continue
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) query.append(key, v)
    } else {
      query.set(key, value)
    }
  }
  const qs = query.toString()
  redirect(`${ROUTES.shiftHistory}${qs ? `?${qs}` : ""}`)
}
