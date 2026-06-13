<#
.SYNOPSIS
  shift_database の日次バックアップスクリプト（PostgreSQL 17 / Windows Server 2019）

.DESCRIPTION
  - pg_dump でカスタム形式（圧縮・部分リストア可）の論理バックアップを取得
  - ダンプ・.env / .env.test（秘密情報）を公開鍵で暗号化して退避（*.cms）
  - 保持期間を過ぎた古い世代を自動削除
  - 実行結果を backup.log に追記

  DB接続情報はプロジェクトの .env の DATABASE_URL から自動取得するため、
  本スクリプト内にパスワードを直書きしない。

  暗号化は公開鍵（$PubCert の .cer）で行い、復号に必要な秘密鍵はサーバーに置かない。
  共有フォルダにアクセスできる人でも、秘密鍵なしには復元できない。詳細は
  docs/plans/backup-encryption-cms-design.md / scripts/backup/README.md を参照。

.NOTES
  タスクスケジューラからの実行を想定。手動実行も可。
#>

# ===== 設定（必要に応じて変更）=====
$BackupRoot   = "C:\backups"                                  # バックアップ保存先
$RetentionDays = 14                                           # 保持日数（これより古い世代は削除）
$PgBin        = "C:\Program Files\PostgreSQL\17\bin"          # PostgreSQL バイナリの場所
# 成果物を暗号化する公開鍵証明書（.cer）。秘密鍵はサーバーに置かない（復元担当者がオフライン保管）
$PubCert      = Join-Path $PSScriptRoot "keys\shiftdb-backup-pub.cer"
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

# ----- 公開鍵暗号化ヘルパ -----
# CMS（Protect-CmsMessage）はテキスト前提のため base64 を噛ませてバイト無損失にする。
# 入力ファイルは削除しない（呼び出し側の責務。.env など消してはいけない元ファイルがあるため）。
function Protect-FileCms {
    param([string]$InPath, [string]$OutPath, [string]$Cert)
    $b64 = [System.Convert]::ToBase64String([System.IO.File]::ReadAllBytes($InPath))
    Protect-CmsMessage -To $Cert -Content $b64 -OutFile $OutPath
    # 健全性チェック: CMS 形式かつ非ゼロ。サーバーは秘密鍵を持たず復元可否までは検証できない（→ 復元ドリルで担保）
    if ((Get-Item $OutPath).Length -eq 0 -or
        -not (Select-String -Path $OutPath -Pattern '-----BEGIN CMS-----' -Quiet)) {
        throw "暗号化結果が不正です: $OutPath"
    }
}

try {
    # 出力フォルダ作成
    foreach ($d in @($BackupRoot, $DumpDir, $SecretDir)) {
        if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }

    Write-Log "===== バックアップ開始 ====="

    # ----- 暗号化用の公開鍵証明書を確認（無ければ fail-closed で中止）-----
    if (-not (Test-Path $PubCert)) {
        throw "公開鍵証明書が見つかりません: $PubCert（README の鍵ペア作成手順を参照）"
    }

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

    # ----- ダンプを公開鍵で暗号化し、平文を削除 -----
    Protect-FileCms -InPath $dumpFile -OutPath "$dumpFile.cms" -Cert $PubCert
    Remove-Item $dumpFile -Force   # 暗号化成功を確認してから平文ダンプを削除
    Write-Log "ダンプを暗号化: $dumpFile.cms"

    # ----- 秘密情報（.env / .env.test）の暗号化退避 -----
    # 元ファイル（プロジェクト直下の .env 等）は削除せず、暗号化コピーのみを secrets\ に作る
    foreach ($name in @(".env", ".env.test")) {
        $src = Join-Path $ProjectRoot $name
        if (Test-Path $src) {
            $dst = Join-Path $SecretDir ("{0}_{1}.cms" -f $name.TrimStart('.'), $Stamp)
            Protect-FileCms -InPath $src -OutPath $dst -Cert $PubCert
            (Get-Item $dst).LastWriteTime = Get-Date   # コピー元の古い更新日時を引き継がせない（世代管理対象から即削除されるのを防ぐ）
            Write-Log "秘密情報を暗号化退避: $dst"
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
    exit 0
}
catch {
    Write-Log "バックアップ失敗: $($_.Exception.Message)" "ERROR"
    if ($env:PGPASSWORD) { $env:PGPASSWORD = $null }
    # fail-closed: 暗号化されなかった平文を共有へ漏らさない。
    # db\ / secrets\ には本来 .cms しか存在しないため、非 .cms（暗号化前/失敗の平文）を全削除する。
    foreach ($dir in @($DumpDir, $SecretDir)) {
        if (Test-Path $dir) {
            Get-ChildItem $dir -File -ErrorAction SilentlyContinue |
                Where-Object { $_.Extension -ne ".cms" } |
                ForEach-Object {
                    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
                    Write-Log "fail-closed: 平文を削除 $($_.FullName)" "WARN"
                }
        }
    }
    exit 1
}
