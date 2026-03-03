import { redirect } from "next/navigation"
import type { SearchParams } from "@/types"

export default async function ShiftHistoryPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  query.set("tab", "history")

  for (const [key, value] of Object.entries(params)) {
    if (key !== "tab" && typeof value === "string") {
      query.set(key, value)
    }
  }

  redirect(`/shifts?${query.toString()}`)
}
