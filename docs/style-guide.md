# スタイルガイド

本プロジェクトのデザインシステムとスタイリング規約をまとめたドキュメント。

## デザインシステム概要

- **UIライブラリ**: shadcn/ui (new-york スタイル)
- **CSSフレームワーク**: Tailwind CSS 4
- **カラースペース**: OKLCh（`oklch()` 関数）
- **ベースカラー**: neutral
- **設定ファイル**: `components.json`, `app/globals.css`

## カラーシステム

CSS カスタムプロパティで定義し、OKLCh カラースペースを使用する。

### セマンティックカラー

| トークン | 用途 |
|----------|------|
| `--background` / `--foreground` | ページ全体の背景色・文字色 |
| `--card` / `--card-foreground` | カード要素の背景・文字 |
| `--popover` / `--popover-foreground` | ポップオーバー・ドロップダウンの背景・文字 |
| `--primary` / `--primary-foreground` | 主要アクション（ボタン、リンク強調） |
| `--secondary` / `--secondary-foreground` | 副次アクション |
| `--muted` / `--muted-foreground` | 控えめな要素・補助テキスト |
| `--accent` / `--accent-foreground` | ホバー状態・強調背景 |
| `--destructive` | 削除・エラーなど破壊的アクション |
| `--border` | ボーダー色 |
| `--input` | 入力フィールドのボーダー |
| `--ring` | フォーカスリング |

### ライトモード値

```css
:root {
  --background: oklch(1 0 0);           /* 白 */
  --foreground: oklch(0.145 0 0);       /* ほぼ黒 */
  --primary: oklch(0.205 0 0);          /* 非常に暗い */
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --destructive: oklch(0.577 0.245 27.325);  /* 赤系 */
  --border: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

### ダークモード値

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}
```

ダークモードは `@custom-variant dark (&:is(.dark *));` で切り替え。

### チャートカラー

`--chart-1` 〜 `--chart-5` はライト/ダーク各モードで個別定義。グラフ描画時に使用。

### サイドバーカラー

`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` でサイドバー専用の配色を管理。

## タイポグラフィ

### フォント

| 用途 | フォント | CSS 変数 |
|------|---------|----------|
| 本文・UI | Geist Sans | `--font-geist-sans` |
| コード・等幅 | Geist Mono | `--font-geist-mono` |

`app/layout.tsx` で `next/font/google` から読み込み、CSS 変数として設定。`body` に `antialiased` を適用。

### テキストサイズの使い分け

- `text-xs` (0.75rem): バッジ、補足ラベル
- `text-sm` (0.875rem): ボタン、フォーム入力、テーブルセル（標準UIサイズ）
- `text-base` (1rem): 本文
- `text-lg` 以上: ページタイトル、見出し

## スペーシング・角丸

### スペーシング

基本単位は **4px**（Tailwind のデフォルト）。`gap-2`(8px)、`p-4`(16px) など 4 の倍数で統一。

### 角丸スケール

ベース値: `--radius: 0.625rem` (10px)

| トークン | 計算 | 実値 |
|----------|------|------|
| `--radius-sm` | `var(--radius) - 4px` | 6px |
| `--radius-md` | `var(--radius) - 2px` | 8px |
| `--radius-lg` | `var(--radius)` | 10px |
| `--radius-xl` | `var(--radius) + 4px` | 14px |
| `--radius-2xl` | `var(--radius) + 8px` | 18px |
| `--radius-3xl` | `var(--radius) + 12px` | 22px |
| `--radius-4xl` | `var(--radius) + 16px` | 26px |

shadcn/ui コンポーネントは `rounded-md` をデフォルトで使用。

## コンポーネントパターン

### CVA (class-variance-authority) によるバリアント管理

shadcn/ui コンポーネントは CVA でバリアントを定義する。

```tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center ...", // 共通クラス
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground ...",
        destructive: "bg-destructive text-white ...",
        outline: "border bg-background ...",
        secondary: "bg-secondary text-secondary-foreground ...",
        ghost: "hover:bg-accent ...",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

### `cn()` ユーティリティ

`lib/utils.ts` で定義。`clsx` + `tailwind-merge` の組み合わせ。

```tsx
import { cn } from "@/lib/utils"

// 条件付きクラスの結合・Tailwind クラスの競合解決に使用
<div className={cn("base-class", isActive && "active-class", className)} />
```

カスタムコンポーネントでは必ず `cn()` を使ってクラスを結合すること。

## レスポンシブデザイン

モバイルファーストでブレークポイントを使用。Tailwind CSS 4 のデフォルトブレークポイントに準拠。

```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

モバイル向けスタイルを先に記述し、`md:` や `lg:` で上書きするパターンを遵守。

## アイコン

- **ライブラリ**: Lucide React (`components.json` の `iconLibrary: "lucide"`)
- **標準サイズ**: `size-4` (16px)。SVG 内の `[&_svg:not([class*='size-'])]:size-4` で自動適用。
- **小サイズ**: `size-3` (12px) — `xs` バリアント内で使用

```tsx
import { Plus, Trash2 } from "lucide-react"

<Button><Plus /> 追加</Button>
<Button variant="destructive" size="icon"><Trash2 /></Button>
```

## フォーカス・アクセシビリティ

### フォーカスリング

- リング幅: **3px** (`ring-[3px]`)
- パターン: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- `focus-visible` を使用し、キーボード操作時のみリングを表示
- ベーススタイル: `outline-ring/50`（`globals.css` の `@layer base` で全要素に適用）

### エラー状態

- `aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40`
- `aria-invalid:border-destructive`

## シフトコード配色

`lib/constants.ts` でシフト表示に使用するカラーを管理。

### SHIFT_CODE_MAP（デフォルトマッピング）

| コード | ラベル | テキスト色 | 背景色 |
|--------|--------|-----------|--------|
| A | 日勤A | `text-blue-800` | `bg-blue-100` |
| B | 日勤B | `text-indigo-800` | `bg-indigo-100` |
| C | 日勤C | `text-purple-800` | `bg-purple-100` |
| N | 夜勤 | `text-gray-800` | `bg-gray-200` |
| H | 休日 | `text-red-800` | `bg-red-100` |
| Y | 有給 | `text-green-800` | `bg-green-100` |
| T | テレワーク | `text-sky-800` | `bg-sky-100` |
| R | 振休 | `text-orange-800` | `bg-orange-100` |
| S | 特休 | `text-yellow-800` | `bg-yellow-100` |

### COLOR_PALETTE（ユーザー選択用パレット）

シフトコード作成時にユーザーが選べるカラーパレット。全 18 色。

パターン: テキスト `text-{color}-800` + 背景 `bg-{color}-100` + スウォッチ `bg-{color}-500`

利用可能な色: blue, indigo, purple, gray, red, green, sky, orange, yellow, pink, teal, emerald, rose, amber, cyan, violet, lime, slate

### getShiftCodeInfo()

シフトコードの表示情報を取得する関数。DB マップ → ハードコードフォールバック → 汎用フォールバックの順で解決。

## 注意事項

- `components/ui/` 配下のファイルは手動編集禁止。新規コンポーネントの追加は `npx shadcn add <component>` を使用すること。
- カスタムコンポーネントは `components/` 直下またはサブディレクトリに配置する。
- セマンティックカラートークン（`bg-primary`, `text-muted-foreground` など）を優先し、Tailwind のカラー直接指定（`bg-blue-500` 等）はシフトコード配色など特定用途に限定する。
- カスタムスタイルの追加は `globals.css` の `@layer base` 内で行う。
