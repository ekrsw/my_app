# データベースバックアップ

shift_database（PostgreSQL）の日次バックアップ用スクリプトと運用手順。
Windows Server 2019 でのセルフホスト運用を想定。

## 概要

- **方式**: `pg_dump` によるカスタム形式（圧縮・部分リストア可）の論理バックアップ
- **暗号化**: 成果物（ダンプ・秘密情報）を**公開鍵で暗号化**（`Protect-CmsMessage` / X.509）。
  サーバーには公開鍵 `.cer` のみ。復号に必要な秘密鍵はサーバーにも共有フォルダにも置かない。
- **対象**: DB本体 + `.env` / `.env.test`（秘密情報）。いずれも `.cms` として暗号化保存。
- **スケジュール**: 毎日 02:00（タスクスケジューラ）
- **世代管理**: 14日より古い世代を自動削除
- **保存先**: `C:\backups\`（`db\` に暗号化ダンプ `*.cms`、`secrets\` に暗号化秘密情報 `*.cms`、`backup.log` に実行ログ）

> DB接続情報はプロジェクトの `.env` の `DATABASE_URL` から自動取得するため、
> スクリプト内にパスワードを直書きしていません。`.env` は Git 管理外です。

> **なぜ暗号化するか**: バックアップは暗号化されていない共有フォルダ（NAS）へ複製される。
> 共有にアクセスできる人なら誰でも平文ダンプを `pg_restore` で復元できてしまう、という脅威に対し、
> 成果物自体を公開鍵で暗号化する。設計の詳細は `docs/plans/backup-encryption-cms-design.md` を参照。
> 共有のアクセス権を絞れないため、暗号化が唯一の防御線になる。

## ファイル

| ファイル | 役割 |
|----------|------|
| `backup-db.ps1` | バックアップ本体（ダンプ取得・秘密情報退避・世代管理） |
| `register-task.ps1` | タスクスケジューラへ日次バックアップを登録（要管理者権限） |
| `sync-backup.ps1` | `C:\backups` を共有フォルダ（別サーバー/NAS）へ複製（robocopy） |
| `register-sync-task.ps1` | タスクスケジューラへ日次同期を登録（要管理者権限） |

## 前提条件

- PostgreSQL クライアント（`pg_dump.exe` / `pg_restore.exe`）がインストール済み
- プロジェクトルートに `.env`（`DATABASE_URL` を含む）が配置済み
- **暗号化用の公開鍵証明書を配置済み**: `scripts/backup/keys/shiftdb-backup-pub.cer`
  （無いとバックアップは fail-closed で中止する。作成手順は下記「鍵ペアの作成」を参照）
- `backup-db.ps1` 冒頭の設定値が環境に合っていること:
  - `$BackupRoot` … バックアップ保存先（既定 `C:\backups`）
  - `$RetentionDays` … 保持日数（既定 14）
  - `$PgBin` … PostgreSQL バイナリの場所（既定 `C:\Program Files\PostgreSQL\17\bin`）
  - `$PubCert` … 公開鍵証明書のパス（既定 `scripts/backup/keys/shiftdb-backup-pub.cer`）

> ⚠️ 本番環境では PostgreSQL のバージョン/パスやプロジェクトの配置パスが
> 異なる場合があります。`$PgBin` とタスク登録時のスクリプトパスを本番に合わせて調整してください。

## 鍵ペアの作成（初回のみ・復元担当者のマシンで）

公開鍵でバックアップを暗号化し、秘密鍵でのみ復元できるようにする。**鍵はサーバーではなく
復元担当者の手元で作る**。公開鍵だけをサーバーへ配り、秘密鍵はオフライン保管する。

```powershell
# 1) 鍵ペアを作成（DocumentEncryptionCert = Protect-CmsMessage 用）
$cert = New-SelfSignedCertificate `
  -Subject "CN=ShiftDB Backup Recovery" `
  -KeyUsage DataEncipherment, KeyEncipherment `
  -KeyAlgorithm RSA -KeyLength 4096 `
  -Type DocumentEncryptionCert `
  -CertStoreLocation Cert:\CurrentUser\My `
  -NotAfter (Get-Date).AddYears(20)

# 2) 公開鍵のみエクスポート → サーバーの scripts\backup\keys\ へ配置（機密ではない）
Export-Certificate -Cert $cert -FilePath .\shiftdb-backup-pub.cer

# 3) 秘密鍵込みでエクスポート（パスワード保護）→ オフライン保管（2部以上・別媒体）
$pw = Read-Host -AsSecureString "PFXパスワード"
Export-PfxCertificate -Cert $cert -FilePath .\shiftdb-backup-recovery.pfx -Password $pw

# 4) サムプリントを控える（公開鍵差し替え検知用）。サーバーの .cer と定期照合する
$cert.Thumbprint
```

- `shiftdb-backup-pub.cer` … サーバーの `scripts/backup/keys/` に配置（Git 管理外推奨）。
- `shiftdb-backup-recovery.pfx` + PFXパスワード … **オフライン保管**。
  **これを失うと過去バックアップは一切復元できない**。2部以上・別媒体に保管し、
  下記「復元ドリル」で定期的に復元できることを確認する。

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

バックアップは `.cms`（暗号化済み）なので、**まず秘密鍵で復号**してから `pg_restore` する。
復号には「鍵ペアの作成」で作った `shiftdb-backup-recovery.pfx` が必要（復元担当者のマシンで実施）。

```powershell
# 0) 秘密鍵 PFX をインポート（一時的でよい）
Import-PfxCertificate -FilePath .\shiftdb-backup-recovery.pfx `
  -CertStoreLocation Cert:\CurrentUser\My -Password (Read-Host -AsSecureString)

# 1) 暗号化ダンプを復号（Unprotect は base64 文字列を返す → バイトに戻す。-OutFile は無い）
#    ※ [IO.File] の相対パスは PowerShell のカレントではなく .NET のカレントで解決される。
#       必ず絶対パスを渡すこと（Join-Path (Get-Location) で PowerShell の現在地を絶対パス化）。
$restore = Join-Path (Get-Location) "restore.dump"
$b64 = Unprotect-CmsMessage -Path "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump.cms"
[System.IO.File]::WriteAllBytes($restore, [System.Convert]::FromBase64String($b64))

# 2) アーカイブ内容の確認（破損チェック）
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list $restore

# 3) 既存DBへ復元（--clean で既存オブジェクトを削除してから復元）
$env:PGPASSWORD = "（DBパスワード）"
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -h localhost -p 5432 -U my_user -d shift_database `
  --clean --if-exists $restore
$env:PGPASSWORD = $null

# 4) 復号した平文を残さない
Remove-Item $restore -Force
```

`.env` を戻す場合も同様に復号する（同じく絶対パスを渡す）:

```powershell
$envOut = Join-Path (Get-Location) ".env"
$b64 = Unprotect-CmsMessage -Path "C:\backups\secrets\env_YYYYMMDD_HHMMSS.cms"
[System.IO.File]::WriteAllBytes($envOut, [System.Convert]::FromBase64String($b64))
```

> 履歴テーブル用のトリガー・関数（PL/pgSQL）もダンプに含まれるため、スキーマごと復元されます。
> 復元後は `.env` も `secrets\` の暗号化退避物から復号して戻すこと（DBだけ戻してもアプリは起動しません）。

## 復元ドリル（四半期ごと・必須）

公開鍵方式ではサーバーは秘密鍵を持たず、**暗号化バックアップが本当に復元できるかをサーバー自身では
検証できない**。静かに復元不能になっていた、という最悪の事態（気づくのは本番障害時）を避けるため、
秘密鍵での実復元を定期的に行う。

- **頻度**: 四半期ごと。鍵・PowerShell・証明書を更新したら臨時で必ず実施。
- **担当**: 復元担当者（秘密鍵 PFX 保持者）。
- **環境**: 本番とは別のテストDB（本番 `shift_database` を上書きしない）。
- **手順**: 上記リストア手順を**テストDBに対して**実行 → 主要テーブルの件数・サンプル行を確認。
- **合格条件**: 復号物が `pg_restore --list` を通り、テストDBへ復元でき、データが妥当。
- **記録**: 実施日・対象世代・結果を `C:\backups\restore-drill.log` などに残す。

## 保管戦略（重要）

このサーバーには C: ドライブしかなく、バックアップも同一ディスク上にあります。
**サーバー/ディスク障害時に全滅する**ため、3-2-1 ルールに従い別拠点への複製を強く推奨します。

- `C:\backups\` を 1日1回、別サーバー / NAS / クラウドストレージへ同期（下記「共有フォルダへの同期」参照）
- ダンプ・`secrets\` ともに `backup-db.ps1` の時点で公開鍵暗号化（`.cms`）されるため、
  同期先が暗号化されていなくても中身は復号鍵なしには取り出せない。
  さらに `sync-backup.ps1` は `*.cms` / `*.log` のみを複製する許可リスト方式（`/IF`）で、
  万一ローカルに平文が紛れ込んでも共有へは出さない（多層防御）。

## 共有フォルダへの同期

`C:\backups\` を別サーバー / NAS の共有フォルダへ複製し、ディスク障害時の全滅を防ぎます。
`sync-backup.ps1` は Windows 標準の `robocopy` を使用します。
複製対象は `/IF` 許可リストにより **`*.cms`（暗号文）と `*.log`（ログ）のみ**。平文は共有へ出ません。

> ⚠ ミラーモード（`$Mirror = $true`）と `/IF` を併用すると、許可リスト外のファイルが同期先で
> 予期せず削除される場合があります。既定の追加コピー（`/E`）での運用を推奨します。

### 動作モード

- **既定（追加コピーのみ / `$Mirror = $false`）**: 同期先にファイルを追加していくのみ。
  ローカルが破損・全消失しても同期先に過去世代が残るため、オフサイト退避として安全。
  ただし同期先の容量は増え続けるため、定期的な手動整理が必要。
- **ミラー（`$Mirror = $true`）**: 同期先を `C:\backups\` と完全一致させる。
  ローカルで世代管理により削除された古い世代は、同期先からも削除される（容量は一定）。

### 1. 設定値の調整

同期先パスはプロジェクトルートの `.env` から取得します（DB接続情報と同じく Git 管理外）。
`.env` に以下を追記:

```dotenv
# 同期先（UNC パス または マッピング済みドライブ）【必須】
BACKUP_SYNC_DEST=\\NAS\backups\shift_db
# 実行アカウント自体に共有アクセス権がない場合のみ設定【任意・通常は不要】
BACKUP_SYNC_USER=NAS\backupuser
BACKUP_SYNC_PASS=（共有アクセス用パスワード）
```

robocopy の挙動は `sync-backup.ps1` 冒頭で切り替えます:

- `$Mirror` … `$true` でミラー、`$false`（既定）で追加コピーのみ

### 2. 手動実行で動作確認

通常の PowerShell（昇格不要）で実行。実行アカウントが共有にアクセスできることが前提:

```powershell
cd C:\path\to\my_app
powershell -ExecutionPolicy Bypass -File .\scripts\backup\sync-backup.ps1
```

成功すると同期先に `db\` / `secrets\` が複製され、`C:\backups\sync.log` に実行ログ、
`C:\backups\sync-robocopy.log` に robocopy 詳細ログが記録されます。

### 3. タスクスケジューラへ登録（要管理者権限）

> ⚠ 共有フォルダ（UNC）へアクセスするには **SYSTEM ではなく、共有にアクセス権を持つ実ユーザー**で
> 実行する必要があります。`-RunAsUser` を必ず指定してください。

PowerShell を **「管理者として実行」** で起動し:

```powershell
cd C:\path\to\my_app
powershell -ExecutionPolicy Bypass -File .\scripts\backup\register-sync-task.ps1 -RunAsUser "DOMAIN\backupuser"
```

実行ユーザーのパスワード入力を求められます（タスクに安全に保存され、未ログオン時も実行されます）。
`OK: タスク 'ShiftDB-DailySync' を登録しました（毎日 02:30 実行）` と表示されれば完了。

> 既定の実行時刻は 02:30。バックアップ本体（`ShiftDB-DailyBackup` / 02:00）の完了後に走るよう調整済み。
> 時刻を変える場合は `-At "03:00"` のように指定します。

### 4. 登録後の確認

```powershell
# タスクを今すぐ手動実行
Start-ScheduledTask -TaskName "ShiftDB-DailySync"

# 次回実行時刻・前回結果の確認
Get-ScheduledTaskInfo -TaskName "ShiftDB-DailySync"

# 同期ログの確認
Get-Content C:\backups\sync.log -Tail 8
```

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
- **`.env に BACKUP_SYNC_DEST（同期先パス）が設定されていません`**
  → プロジェクトルートの `.env` に `BACKUP_SYNC_DEST=\\サーバー\共有\パス` を追記する。
- **同期タスクが共有にアクセスできない（`同期先にアクセスできません`）**
  → SYSTEM で登録していると UNC 共有にアクセスできない。`-RunAsUser` で共有アクセス権を持つ
  ユーザーを指定して `register-sync-task.ps1` を再実行する。手動実行で成功しタスクで失敗する場合も同原因。
- **`robocopy が失敗しました (exit=8 以上)`**
  → `C:\backups\sync-robocopy.log` で詳細を確認。共有の空き容量・権限・ネットワーク断を疑う。
