<#
.SYNOPSIS
  shift_database の日次バックアップスクリプト（PostgreSQL 17 / Windows Server 2019）

.DESCRIPTION
  - pg_dump でカスタム形式（圧縮・部分リストア可）の論理バックアップを取得
  - ダンプと秘密情報（.env / .env.test / secrets\keyring.json）を 7-Zip(AES-256) で
    暗号化し、平文を残さずに保存（保存時の盗難・NAS 複製先への流出に備える）
  - 保持期間を過ぎた古い世代を自動削除
  - 実行結果を backup.log に追記

  DB接続情報はプロジェクトの .env の DATABASE_URL から自動取得するため、
  本スクリプト内にパスワードを直書きしない。

  暗号化パスフレーズは BackupRoot の外（環境変数 BACKUP_PASSPHRASE または
  DPAPI 保護ファイル $PassphraseFile）から取得し、バックアップの隣には置かない。

.NOTES
  タスクスケジューラからの実行を想定。手動実行も可。
  稼働中の PostgreSQL データ領域そのものの保存時暗号化は BitLocker で行う
  （README の「保存時暗号化（at-rest）」参照）。本スクリプトはバックアップ成果物の暗号化を担う。
#>

# ===== 設定（必要に応じて変更）=====
$BackupRoot   = "C:\backups"                                  # バックアップ保存先
$RetentionDays = 14                                           # 保持日数（これより古い世代は削除）
$PgBin        = "C:\Program Files\PostgreSQL\17\bin"          # PostgreSQL バイナリの場所
$SevenZipBin  = "C:\Program Files\7-Zip"                      # 7-Zip(7z.exe) の場所
# 暗号化パスフレーズの保管先（DPAPI 保護ファイル）。BackupRoot の外に置くこと。
# 環境変数 BACKUP_PASSPHRASE が設定されていればそちらを優先する。
$PassphraseFile = Join-Path $env:ProgramData "shift-backup\backup.pass"
# ===================================

$ErrorActionPreference = "Stop"

# プロジェクトルート（このスクリプトの2階層上: scripts\backup\ -> project root）
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile     = Join-Path $ProjectRoot ".env"

$DumpDir   = Join-Path $BackupRoot "db"
$SecretDir = Join-Path $BackupRoot "secrets"
$LogFile   = Join-Path $BackupRoot "backup.log"
$Stamp     = Get-Date -Format "yyyyMMdd_HHmmss"

# ----- ログ出力ヘルパ -----
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# ----- 暗号化パスフレーズの解決（BackupRoot の外から取得）-----
# 優先: 環境変数 BACKUP_PASSPHRASE → なければ DPAPI 保護ファイル $PassphraseFile。
# どちらも無ければ throw（平文バックアップの生成を防ぐ）。
function Resolve-BackupPassphrase {
    if (-not [string]::IsNullOrWhiteSpace($env:BACKUP_PASSPHRASE)) {
        return $env:BACKUP_PASSPHRASE
    }
    if (Test-Path $PassphraseFile) {
        # DPAPI: このユーザー（タスク実行アカウント）のみ復号可能な SecureString を1行で保存したもの
        $secure = (Get-Content $PassphraseFile -Raw).Trim() | ConvertTo-SecureString
        return [System.Net.NetworkCredential]::new("", $secure).Password
    }
    throw "暗号化パスフレーズが未設定です（環境変数 BACKUP_PASSPHRASE もしくは $PassphraseFile）。平文バックアップを避けるため中止します。"
}

# ----- 1ファイルを 7-Zip(AES-256) で暗号化（-mhe=on でヘッダも暗号化）-----
# 成功後に平文の元ファイルを削除し、生成した .7z のパスを返す。
function Protect-FileWith7Zip {
    param(
        [Parameter(Mandatory)] [string]$SourceFile,
        [Parameter(Mandatory)] [string]$Passphrase
    )
    $sevenZip = Join-Path $SevenZipBin "7z.exe"
    if (-not (Test-Path $sevenZip)) { throw "7z.exe が見つかりません: $sevenZip" }
    $archive = "$SourceFile.7z"
    if (Test-Path $archive) { Remove-Item $archive -Force }
    # -mx=1: 軽圧縮（dump は圧縮済み）/ -mhe=on: ファイル名等メタも暗号化 / -p: パスフレーズ
    # 注: 7-Zip CLI はパスフレーズを引数で渡すため一時的にプロセス一覧へ現れる（ローカル限定脅威・許容）。
    try {
        & $sevenZip a -t7z -mx=1 -mhe=on ("-p{0}" -f $Passphrase) -- $archive $SourceFile | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "7-Zip 暗号化に失敗しました (exit=$LASTEXITCODE): $SourceFile" }
    }
    catch {
        if (Test-Path $archive) { Remove-Item $archive -Force }   # 中途半端な暗号化物を残さない
        throw
    }
    finally {
        # 成否にかかわらず平文の元ファイルを残さない（dump は再生成可・secret は原本が別にある）。
        # これにより 7z 失敗時に平文の秘密コピーがディスクに取り残されることを防ぐ。
        if (Test-Path $SourceFile) { Remove-Item $SourceFile -Force }
    }
    return $archive
}

try {
    # 出力フォルダ作成
    foreach ($d in @($BackupRoot, $DumpDir, $SecretDir)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }

    Write-Log "===== バックアップ開始 ====="

    # ----- 暗号化パスフレーズを先に解決（未設定なら平文を作らず即中止）-----
    $Passphrase = Resolve-BackupPassphrase

    # ----- .env から DATABASE_URL を読み取り、接続情報をパース -----
    if (-not (Test-Path $EnvFile)) { throw ".env が見つかりません: $EnvFile" }

    $dbUrl = (Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
              Select-Object -First 1) -replace '^\s*DATABASE_URL\s*=\s*', '' -replace '^"|"$', ''
    if ([string]::IsNullOrWhiteSpace($dbUrl)) { throw ".env に DATABASE_URL が見つかりません" }

    if ($dbUrl -notmatch 'postgres(?:ql)?://(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^:/]+):(?<port>\d+)/(?<db>[^?]+)') {
        throw "DATABASE_URL の形式を解釈できません"
    }
    $DbUser = $Matches.user
    $DbPass = $Matches.pass
    $DbHost = $Matches.host
    $DbPort = $Matches.port
    $DbName = $Matches.db

    Write-Log "対象DB: $DbName @ ${DbHost}:${DbPort}（ユーザー: $DbUser）"

    # ----- pg_dump 実行（カスタム形式 -F c）-----
    $dumpFile = Join-Path $DumpDir ("{0}_{1}.dump" -f $DbName, $Stamp)
    $pgDump = Join-Path $PgBin "pg_dump.exe"
    if (-not (Test-Path $pgDump)) { throw "pg_dump.exe が見つかりません: $pgDump" }

    $env:PGPASSWORD = $DbPass
    & $pgDump -h $DbHost -p $DbPort -U $DbUser -d $DbName -F c -f $dumpFile
    $code = $LASTEXITCODE
    $env:PGPASSWORD = $null   # メモリ上のパスワードをクリア

    if ($code -ne 0) { throw "pg_dump が異常終了しました (exit=$code)" }

    $sizeMB = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)
    Write-Log "DBダンプ完了: $dumpFile (${sizeMB} MB)"

    # ----- ダンプを 7-Zip(AES-256) で暗号化し、平文ダンプを削除 -----
    $encDump = Protect-FileWith7Zip -SourceFile $dumpFile -Passphrase $Passphrase
    Write-Log "ダンプを暗号化: $encDump（平文ダンプは削除）"

    # ----- 秘密情報の暗号化退避（.env / .env.test / keyring）-----
    # keyring.json は DEK が二重鍵でラップ済みだが、DR のため暗号化して併せて退避する。
    $secretItems = @(".env", ".env.test", "secrets\keyring.json")
    foreach ($rel in $secretItems) {
        $src = Join-Path $ProjectRoot $rel
        if (Test-Path $src) {
            $leaf = ($rel -replace '[\\/]', '_').TrimStart('.')
            $dst = Join-Path $SecretDir ("{0}_{1}" -f $leaf, $Stamp)
            Copy-Item $src $dst -Force
            $encDst = Protect-FileWith7Zip -SourceFile $dst -Passphrase $Passphrase
            (Get-Item $encDst).LastWriteTime = Get-Date   # コピー元の古い更新日時を引き継がせない（世代管理対象から即削除されるのを防ぐ）
            Write-Log "秘密情報を暗号化退避: $encDst（平文コピーは削除）"
        }
    }

    # ----- 世代管理（保持日数を超えた古いファイルを削除）-----
    $threshold = (Get-Date).AddDays(-$RetentionDays)
    $deleted = 0
    foreach ($dir in @($DumpDir, $SecretDir)) {
        Get-ChildItem $dir -File | Where-Object { $_.LastWriteTime -lt $threshold } | ForEach-Object {
            Remove-Item $_.FullName -Force
            $deleted++
        }
    }
    Write-Log "古い世代を削除: $deleted 件（保持 $RetentionDays 日）"

    Write-Log "===== バックアップ正常終了 ====="
    $Passphrase = $null   # メモリ上のパスフレーズをクリア
    exit 0
}
catch {
    Write-Log "バックアップ失敗: $($_.Exception.Message)" "ERROR"
    if ($env:PGPASSWORD) { $env:PGPASSWORD = $null }
    $Passphrase = $null
    exit 1
}
