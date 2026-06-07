<#
.SYNOPSIS
  C:\backups を共有フォルダ（別サーバー / NAS）へ複製する同期スクリプト

.DESCRIPTION
  - robocopy で $BackupRoot（既定 C:\backups）を 同期先へコピー
  - 同期先パスはプロジェクトの .env の BACKUP_SYNC_DEST から取得（スクリプトに直書きしない）
  - 既定は「追加コピーのみ（削除しない）」。ローカルが破損・全消失しても
    同期先には過去世代が残るため、オフサイト退避として安全
  - $Mirror = $true にすると完全ミラー（ローカルで削除された世代は同期先からも削除）
  - 実行結果を sync.log に追記
  - 3-2-1 ルール（別拠点への複製）を満たすことが目的

  .env に必要なキー:
    BACKUP_SYNC_DEST  … 同期先（例: \\NAS\backups\shift_db）【必須】
    BACKUP_SYNC_USER  … 共有アクセス用ユーザー（例: NAS\backupuser）【任意】
    BACKUP_SYNC_PASS  … 上記ユーザーのパスワード【任意】
  ※ USER/PASS は、実行アカウント自体に共有アクセス権がない場合のみ設定（通常は不要）。

  ⚠ 共有フォルダ（UNC）へアクセスするには、実行アカウントに共有/NTFS の
     アクセス権が必要。タスクスケジューラから実行する場合は SYSTEM ではなく
     共有にアクセスできるユーザーで登録すること（register-sync-task.ps1 参照）。

.NOTES
  backup-db.ps1（02:00）の完了後に実行する想定（既定 02:30）。手動実行も可。
#>

# ===== 設定（必要に応じて変更）=====
$BackupRoot = "C:\backups"                       # 同期元（バックアップ保存先）
$Mirror     = $false                             # $true: 完全ミラー / $false: 追加コピーのみ（推奨）
# 同期先・共有認証情報は .env から取得（BACKUP_SYNC_DEST / BACKUP_SYNC_USER / BACKUP_SYNC_PASS）
# ===================================

$ErrorActionPreference = "Stop"
$LogFile = Join-Path $BackupRoot "sync.log"

# プロジェクトルート（このスクリプトの2階層上: scripts\backup\ -> project root）
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$EnvFile     = Join-Path $ProjectRoot ".env"

# ----- ログ出力ヘルパ -----
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $line = "{0} [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# ----- .env から値を取得するヘルパ（backup-db.ps1 と同じ作法。クォートも除去）-----
function Get-EnvValue {
    param([string]$Key)
    if (-not (Test-Path $EnvFile)) { return $null }
    $pattern = "^\s*{0}\s*=" -f [regex]::Escape($Key)
    # .env は UTF-8（BOM無し）。-Encoding UTF8 を明示しないと PS5.1 が CP932 と誤読し日本語が文字化けする
    $line = Get-Content $EnvFile -Encoding UTF8 | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $line) { return $null }
    return ($line -replace ("^\s*{0}\s*=\s*" -f [regex]::Escape($Key)), '') -replace '^"|"$', ''
}

$connectedShare = $false
$shareRoot      = $null

try {
    Write-Log "===== 同期開始 ====="

    if (-not (Test-Path $BackupRoot)) { throw "同期元が見つかりません: $BackupRoot" }
    if (-not (Test-Path $EnvFile))    { throw ".env が見つかりません: $EnvFile" }

    # ----- 同期先・共有認証情報を .env から取得 -----
    $DestRoot  = Get-EnvValue "BACKUP_SYNC_DEST"
    $ShareUser = Get-EnvValue "BACKUP_SYNC_USER"
    $SharePass = Get-EnvValue "BACKUP_SYNC_PASS"
    if ([string]::IsNullOrWhiteSpace($DestRoot)) {
        throw ".env に BACKUP_SYNC_DEST（同期先パス）が設定されていません"
    }

    # ----- 同期先（共有）へのアクセス確認。権限が無ければ .env の資格情報で接続 -----
    # net use は共有ルート（\\server\share）に対して行う。深いパスを渡すと error 67 になる
    $shareRoot = $DestRoot
    if ($DestRoot -match '^(\\\\[^\\]+\\[^\\]+)') { $shareRoot = $Matches[1] }

    if (-not (Test-Path $shareRoot)) {
        if (-not [string]::IsNullOrWhiteSpace($ShareUser)) {
            Write-Log "共有へ認証接続: $shareRoot（ユーザー: $ShareUser）"
            & net use $shareRoot /user:$ShareUser $SharePass /persistent:no | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "共有への接続に失敗しました: $shareRoot (net use exit=$LASTEXITCODE)" }
            $connectedShare = $true
        } else {
            throw "同期先の共有にアクセスできません: $shareRoot（権限を確認、または .env に BACKUP_SYNC_USER/PASS を設定）"
        }
    }

    # ----- 同期先フォルダが無ければ作成 -----
    if (-not (Test-Path $DestRoot)) {
        try { New-Item -ItemType Directory -Path $DestRoot -Force | Out-Null }
        catch { throw "同期先フォルダを作成できません: $DestRoot（$($_.Exception.Message)）" }
    }

    # ----- robocopy 実行 -----
    # /E   : 空フォルダ含めサブフォルダごとコピー
    # /MIR : 完全ミラー（/E + 同期先の余分なファイルを削除）
    # /Z   : 再起動可能モード（大きいファイルの中断耐性）
    # /R:3 /W:10 : 失敗時 3回まで・10秒間隔でリトライ
    # /NP /NDL  : 進捗率・ディレクトリ名のログを抑制
    # /TEE      : コンソールとログ両方へ出力
    $mode = if ($Mirror) { "/MIR" } else { "/E" }
    $rcLog = Join-Path $BackupRoot "sync-robocopy.log"
    $rcArgs = @("`"$BackupRoot`"", "`"$DestRoot`"", $mode, "/Z", "/R:3", "/W:10",
                "/NP", "/NDL", "/TEE", "/LOG+:`"$rcLog`"")

    Write-Log "robocopy 実行（モード: $mode）: $BackupRoot -> $DestRoot"
    & robocopy.exe @rcArgs | Out-Null
    $rc = $LASTEXITCODE

    # robocopy の終了コードは 0-7 が正常、8 以上が失敗
    # 0:変更なし 1:コピー成功 2:余分検出 3:1+2 ...
    if ($rc -ge 8) { throw "robocopy が失敗しました (exit=$rc / 詳細は $rcLog)" }
    Write-Log "robocopy 完了 (exit=$rc)"

    Write-Log "===== 同期正常終了 ====="
    exit 0
}
catch {
    Write-Log "同期失敗: $($_.Exception.Message)" "ERROR"
    exit 1
}
finally {
    # 認証接続していた場合は切断
    if ($connectedShare -and $shareRoot) {
        & net use $shareRoot /delete /yes 2>$null | Out-Null
    }
}
