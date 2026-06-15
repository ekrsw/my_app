import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "@/components/auth/login-form"
import { ROUTES } from "@/lib/routes"

export default async function LoginPage() {
  // 既ログインなら /top へ転送（Premise 3 の `/` → `/top` と対称）
  const session = await auth()
  if (session?.user) {
    redirect(ROUTES.top)
  }

  // LoginForm は useSearchParams() を使うため Suspense 境界が必須
  //（未包囲だと App Router の prerender で build が落ちる）
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
