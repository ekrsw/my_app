import { NextRequest, NextResponse } from "next/server"
import { getShiftVersions } from "@/lib/db/history"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const shiftId = Number(searchParams.get("shiftId"))

  if (!shiftId || isNaN(shiftId)) {
    return NextResponse.json([], { status: 400 })
  }

  const versions = await getShiftVersions(shiftId)
  return NextResponse.json(versions)
}
