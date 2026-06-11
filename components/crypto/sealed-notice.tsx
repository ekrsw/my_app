import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * 暗号化列を含むページが sealed（鍵未ロード）のときに、500 ではなく表示する案内。
 * 書き込み・閲覧には管理者によるアンロックが必要であることを伝える。
 */
export function SealedNotice({ description }: { description?: string }) {
  return (
    <Card className="mx-auto mt-8 max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span aria-hidden>🔒</span> ロック中
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {description ??
          "このページは暗号化された情報を含むため、表示するには管理者によるアンロックが必要です。"}
      </CardContent>
    </Card>
  )
}
