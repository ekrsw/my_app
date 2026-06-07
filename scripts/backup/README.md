# データベースバックアップ

shift_database（PostgreSQL）の日次バックアップ用スクリプトと運用手順。
Windows Server 2019 でのセルフホスト運用を想定。

## 概要

- **方式**: `pg_dump` によるカスタム形式（圧縮・部分リストア可）の論理バックアップ
- **対象**: DB本体 + `.env` / `.env.test`（秘密情報）
- **スケジュール**: 毎日 02:00（タスクスケジューラ）
- **世代管理**: 14日より古い世代を自動削除
- **保存先**: `C:\backups\`（`db\` にダンプ、`secrets\` に秘密情報、`backup.log` に実行ログ）

> DB接続情報はプロジェクトの `.env` の `DATABASE_URL` から自動取得するため、
> スクリプト内にパスワードを直書きしていません。`.env` は Git 管理外です。

## ファイル

| ファイル | 役割 |
|----------|------|
| `backup-db.ps1` | バックアップ本体（ダンプ取得・秘密情報退避・世代管理） |
| `register-task.ps1` | タスクスケジューラへ日次タスクを登録（要管理者権限） |

## 前提条件

- PostgreSQL クライアント（`pg_dump.exe` / `pg_restore.exe`）がインストール済み
- プロジェクトルートに `.env`（`DATABASE_URL` を含む）が配置済み
- `backup-db.ps1` 冒頭の設定値が環境に合っていること:
  - `$BackupRoot` … バックアップ保存先（既定 `C:\backups`）
  - `$RetentionDays` … 保持日数（既定 14）
  - `$PgBin` … PostgreSQL バイナリの場所（既定 `C:\Program Files\PostgreSQL\17\bin`）

> ⚠️ 本番環境では PostgreSQL のバージョン/パスやプロジェクトの配置パスが
> 異なる場合があります。`$PgBin` とタスク登録時のスクリプトパスを本番に合わせて調整してください。

## セットアップ手順

### 1. 手動実行で動作確認

通常の PowerShell（昇格不要）で実行:

```powershell
cd C:\path\to\my_app
powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup-db.ps1
```

成功すると `C:\backups\db\` にダンプ、`C:\backups\secrets\` に秘密情報が作成され、
`C:\backups\backup.log` に実行ログが記録されます。

### 2. タスクスケジューラへ登録（要管理者権限）

PowerShell を **「管理者として実行」** で起動し:

```powershell
cd C:\path\to\my_app
powershell -ExecutionPolicy Bypass -File .\scripts\backup\register-task.ps1
```

`OK: タスク 'ShiftDB-DailyBackup' を登録しました` と表示されれば完了
（毎日 02:00 / SYSTEM アカウント実行）。

### 3. 登録後の確認

```powershell
# タスクを今すぐ手動実行
Start-ScheduledTask -TaskName "ShiftDB-DailyBackup"

# 次回実行時刻・前回結果の確認
Get-ScheduledTaskInfo -TaskName "ShiftDB-DailyBackup"

# 実行ログの確認
Get-Content C:\backups\backup.log -Tail 8
```

## リストア手順

```powershell
# アーカイブ内容の確認（破損チェック）
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump"

# 既存DBへ復元（--clean で既存オブジェクトを削除してから復元）
$env:PGPASSWORD = "（DBパスワード）"
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -h localhost -p 5432 -U my_user -d shift_database `
  --clean --if-exists "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump"
$env:PGPASSWORD = $null
```

> 履歴テーブル用のトリガー・関数（PL/pgSQL）もダンプに含まれるため、スキーマごと復元されます。
> 復元後は `.env` も `secrets\` の退避物から戻すこと（DBだけ戻してもアプリは起動しません）。

## 保管戦略（重要）

このサーバーには C: ドライブしかなく、バックアップも同一ディスク上にあります。
**サーバー/ディスク障害時に全滅する**ため、3-2-1 ルールに従い別拠点への複製を強く推奨します。

- `C:\backups\` を 1日1回、別サーバー / NAS / クラウドストレージへ同期
- オフサイトへ送る際、`secrets\` の中身（平文の `.env`）は暗号化して保管すること

## トラブルシューティング

- **タスク登録が `Access is denied` で失敗する**
  → PowerShell を「管理者として実行」していない。管理者権限で再実行する。
- **スクリプトが構文エラーになる / 日本語が文字化けする**
  → `.ps1` は **UTF-8 (BOM付き)** で保存すること。Windows PowerShell 5.1 は
  BOMなしUTF-8を誤読する。Git 経由で取得した際に文字化けする場合は再保存する。
- **`pg_dump.exe が見つかりません`**
  → `backup-db.ps1` の `$PgBin` をインストール先に合わせて修正する。
- **`.env に DATABASE_URL が見つかりません`**
  → プロジェクトルートに `.env` があり `DATABASE_URL` が設定されているか確認する。
