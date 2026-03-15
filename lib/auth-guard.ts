import { auth } from "@/auth"

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("認証が必要です")
  }
  return session
}
