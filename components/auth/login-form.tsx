"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { safeCallback } from "@/lib/routes"
import { SESSION_EXPIRED_MESSAGE } from "@/lib/auth-session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // セッション絶対期限切れで middleware / requireAuth から飛ばされてきた場合に表示。
  // 初回未認証（reason なし）では出さない（middleware が had_session 痕跡で出し分け）。
  const expired = searchParams.get("reason") === "expired"

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("ユーザー名またはパスワードが正しくありません")
    } else {
      // callbackUrl は同一オリジン相対パスのみ許可（オープンリダイレクト防止）
      router.push(safeCallback(searchParams.get("callbackUrl")))
      router.refresh()
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">ログイン</CardTitle>
        <CardDescription>
          管理者アカウントでログインしてください
        </CardDescription>
      </CardHeader>
      <CardContent>
        {expired && (
          <p
            role="status"
            className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            {SESSION_EXPIRED_MESSAGE}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
