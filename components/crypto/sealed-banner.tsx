import { isUnlocked } from "@/lib/crypto/keyring"

/**
 * sealed（鍵未ロード）の間、全ページ上部に表示する警告バナー。
 * keyring の状態を直接参照する（/api/admin/lock-status と同一ソース）。
 * Server Component（node ランタイム）でのみ使用すること。
 */
export function SealedBanner() {
  if (isUnlocked()) return null
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <span aria-hidden>🔒</span> ロック中 — 暗号化された情報の表示・編集には管理者によるアンロックが必要です。
    </div>
  )
}
