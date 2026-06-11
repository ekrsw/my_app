# データベースバックアップ

shift_database（PostgreSQL）の日次バックアップ用スクリプトと運用手順。
Windows Server 2019 でのセルフホスト運用を想定。

## 概要

- **方式**: `pg_dump` によるカスタム形式（圧縮・部分リストア可）の論理バックアップ
- **対象**: DB本体 + `.env` / `.env.test` / `secrets\keyring.json`（秘密情報）
- **暗号化**: ダンプ・秘密情報を 7-Zip(AES-256) で暗号化し平文を残さない（at-rest 盗難対策）。稼働中の DB 本体は BitLocker で保護（下記参照）
- **スケジュール**: 毎日 02:00（タスクスケジューラ）
- **世代管理**: 14日より古い世代を自動削除
- **保存先**: `C:\backups\`（`db\` に暗号化ダンプ `*.dump.7z`、`secrets\` に暗号化秘密情報 `*.7z`、`backup.log` に実行ログ）

> DB接続情報はプロジェクトの `.env` の `DATABASE_URL` から自動取得するため、
> スクリプト内にパスワードを直書きしていません。`.env` は Git 管理外です。

## ファイル

| ファイル | 役割 |
|----------|------|
| `backup-db.ps1` | バックアップ本体（ダンプ取得・秘密情報退避・世代管理） |
| `register-task.ps1` | タスクスケジューラへ日次バックアップを登録（要管理者権限） |
| `sync-backup.ps1` | `C:\backups` を共有フォルダ（別サーバー/NAS）へ複製（robocopy） |
| `register-sync-task.ps1` | タスクスケジューラへ日次同期を登録（要管理者権限） |

## 前提条件

- PostgreSQL クライアント（`pg_dump.exe` / `pg_restore.exe`）がインストール済み
- **7-Zip** がインストール済み（`7z.exe`、既定 `C:\Program Files\7-Zip`）。バックアップ成果物の AES-256 暗号化に使用
- プロジェクトルートに `.env`（`DATABASE_URL` を含む）が配置済み
- **暗号化パスフレーズの用意**（下記「バックアップの暗号化」参照）
- `backup-db.ps1` 冒頭の設定値が環境に合っていること:
  - `$BackupRoot` … バックアップ保存先（既定 `C:\backups`）
  - `$RetentionDays` … 保持日数（既定 14）
  - `$PgBin` … PostgreSQL バイナリの場所（既定 `C:\Program Files\PostgreSQL\17\bin`）
  - `$SevenZipBin` … 7-Zip の場所（既定 `C:\Program Files\7-Zip`）
  - `$PassphraseFile` … DPAPI 保護パスフレーズの保管先（既定 `%ProgramData%\shift-backup\backup.pass`）

> ⚠️ 本番環境では PostgreSQL のバージョン/パスやプロジェクトの配置パスが
> 異なる場合があります。`$PgBin` とタスク登録時のスクリプトパスを本番に合わせて調整してください。

## セットアップ手順

### 1. 手動実行で動作確認

通常の PowerShell（昇格不要）で実行:

```powershell
cd C:\path\to\my_app
powershell -ExecutionPolicy Bypass -File .\scripts\backup\backup-db.ps1
```

成功すると `C:\backups\db\` に**暗号化済みダンプ（`*.dump.7z`）**、`C:\backups\secrets\` に
**暗号化済み秘密情報（`*.7z`）** が作成され、`C:\backups\backup.log` に実行ログが記録されます。
平文のダンプ・秘密コピーはディスクに残しません（暗号化後に削除）。

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

バックアップは `*.dump.7z`（暗号化済み）なので、まず 7-Zip で復号してから `pg_restore` します。

```powershell
# 0. 暗号化ダンプを復号（パスフレーズを要求される）
& "C:\Program Files\7-Zip\7z.exe" x `
  "C:\backups\db\shift_database_YYYYMMDD_HHMMSS.dump.7z" `
  -o"$env:TEMP\restore" -p"（バックアップ暗号化パスフレーズ）"

# 1. アーカイブ内容の確認（破損チェック）
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list "$env:TEMP\restore\shift_database_YYYYMMDD_HHMMSS.dump"

# 2. 既存DBへ復元（--clean で既存オブジェクトを削除してから復元）
$env:PGPASSWORD = "（DBパスワード）"
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -h localhost -p 5432 -U my_user -d shift_database `
  --clean --if-exists "$env:TEMP\restore\shift_database_YYYYMMDD_HHMMSS.dump"
$env:PGPASSWORD = $null

# 3. 復号した平文ダンプを削除（残さない）
Remove-Item "$env:TEMP\restore" -Recurse -Force
```

> 履歴テーブル用のトリガー・関数（PL/pgSQL）もダンプに含まれるため、スキーマごと復元されます。
> 復元後は `.env` も `secrets\` の退避物（`*.7z` を同様に復号）から戻すこと（DBだけ戻してもアプリは起動しません）。
> アプリレベル暗号化（keyring）を使っている場合、`secrets_keyring.json_*.7z` も復号して `secrets\keyring.json` に戻すこと。これを失い、かつリカバリコードも無いと、暗号化列（業務メモ等）は復号できません。

## バックアップの暗号化（at-rest 盗難対策）

`backup-db.ps1` は、ダンプと秘密情報（`.env` / `.env.test` / `secrets\keyring.json`）を
**7-Zip の AES-256（`-mhe=on` でファイル名等のヘッダも暗号化）** で暗号化してから保存します。
平文はディスクに残しません。これにより、`C:\backups` や複製先 NAS/共有フォルダが流出しても
中身（`shifts` 含む全テーブル・DBパスワード・`AUTH_SECRET` 等）が読めません。

### パスフレーズの用意（バックアップの隣に置かないこと）

優先順位は **環境変数 `BACKUP_PASSPHRASE` → DPAPI 保護ファイル `$PassphraseFile`**。どちらも無いと
スクリプトは平文を作らず中止します。タスクスケジューラは SYSTEM 実行のため、DPAPI ファイル方式を推奨します。

```powershell
# 実行アカウント（例: SYSTEM）でログオンした状態で1回だけ実行し、DPAPI 保護ファイルを作る。
# ※ SYSTEM で作るには PsExec 等で `psexec -s -i powershell` を使う。対話ユーザーで運用するなら不要。
$dir = Join-Path $env:ProgramData "shift-backup"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
Read-Host "バックアップ暗号化パスフレーズ" -AsSecureString |
  ConvertFrom-SecureString | Set-Content (Join-Path $dir "backup.pass") -Encoding ASCII
# このファイルは「作成したユーザーのみ」復号可能（DPAPI）。別アカウントでは読めない点に注意。
```

> パスフレーズは復元に必須です。**パスワードマネージャ等にも別途保管**してください（DPAPI ファイルだけだと、
> マシン故障やアカウント変更で復号不能になり、バックアップが開けなくなります）。
> 注: 7-Zip CLI はパスフレーズをコマンドライン引数で渡すため、暗号化の瞬間だけプロセス一覧に現れます
> （ローカル限定の脅威で、本対策の対象である「保存物の流出」には影響しません）。

## 保存時暗号化（at-rest / 稼働中の DB 本体）

上記はバックアップ成果物の暗号化です。**稼働中の PostgreSQL データ領域そのもの**（`shifts` を含む
全テーブルの実体ファイル・WAL）は、OS の **BitLocker** によるボリューム暗号化で保護します。
これはアプリ・スキーマ・クエリに一切影響しません（テーブル単位のアプリ暗号化と違い、検索・並び替え・
カレンダー表示が壊れない）。

- **対象ボリューム**: PostgreSQL のデータディレクトリ（既定 `C:\Program Files\PostgreSQL\17\data`）と
  `C:\backups` を含むドライブ。
- **有効化（管理者 PowerShell）**:

```powershell
# TPM 搭載機での例（回復キーは必ず別保管）
Enable-BitLocker -MountPoint "C:" -EncryptionMethod XtsAes256 -UsedSpaceOnly -TpmProtector
Get-BitLockerVolume -MountPoint "C:"   # 状態確認（FullyEncrypted を確認）
```

- **複製先 NAS/共有も暗号化**: `sync-backup.ps1` の同期先が別マシンの場合、そのボリュームも
  BitLocker / ストレージ暗号化を有効にしてください（成果物は 7-Zip 済みなので二重で安全）。
- 回復キーは DB パスワードやバックアップパスフレーズとは**別の場所**に保管すること。

## 保管戦略（重要）

このサーバーには C: ドライブしかなく、バックアップも同一ディスク上にあります。
**サーバー/ディスク障害時に全滅する**ため、3-2-1 ルールに従い別拠点への複製を強く推奨します。

- `C:\backups\` を 1日1回、別サーバー / NAS / クラウドストレージへ同期（下記「共有フォルダへの同期」参照）
- ダンプ・`secrets\` の成果物は `backup-db.ps1` が 7-Zip(AES-256) で暗号化済みのため、複製先へ平文は出ません
  （上記「バックアップの暗号化」参照）。`sync-backup.ps1` は暗号化済みファイルをそのまま複製します
- 多層防御として、同期先ボリュームも BitLocker / ストレージ暗号化を有効にし、NTFS/共有権限でアクセス制限することを推奨

## 共有フォルダへの同期

`C:\backups\` を別サーバー / NAS の共有フォルダへ複製し、ディスク障害時の全滅を防ぎます。
`sync-backup.ps1` は Windows 標準の `robocopy` を使用します。

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
