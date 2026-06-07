<#
.SYNOPSIS
  同期スクリプト（sync-backup.ps1）をタスクスケジューラへ登録する（管理者権限で実行）

.DESCRIPTION
  sync-backup.ps1 を毎日 02:30 に実行するタスクを作成する。
  バックアップ本体（02:00）の完了後に走るよう、既定で 30分後に設定。

  ⚠ 共有フォルダ（UNC）へアクセスするには、SYSTEM ではなく
     共有にアクセス権を持つ実ユーザーで実行する必要がある。
     -RunAsUser を指定して登録すること（パスワードはタスクに安全に保存される）。

.PARAMETER RunAsUser
  タスクを実行するユーザー（共有にアクセス可能なアカウント）。
  例: "DOMAIN\backupuser" / ".\localuser"
  省略時は SYSTEM で登録するが、共有フォルダにアクセスできない場合がある。

.PARAMETER At
  実行時刻（既定 02:30）。

.NOTES
  実行例（管理者 PowerShell）:
    powershell -ExecutionPolicy Bypass -File .\scripts\backup\register-sync-task.ps1 -RunAsUser "DOMAIN\backupuser"
#>

param(
    [string]$RunAsUser = "",
    [string]$At        = "02:30"
)

$ErrorActionPreference = "Stop"

# 管理者権限チェック
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "エラー: 管理者権限が必要です。PowerShell を『管理者として実行』してから再実行してください。" -ForegroundColor Red
    exit 1
}

$scriptPath = Join-Path $PSScriptRoot "sync-backup.ps1"
$taskName   = "ShiftDB-DailySync"

if (-not (Test-Path $scriptPath)) { throw "sync-backup.ps1 が見つかりません: $scriptPath" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

if ([string]::IsNullOrWhiteSpace($RunAsUser)) {
    # ユーザー未指定: SYSTEM で登録（共有アクセス不可の可能性あり）
    Write-Host "警告: -RunAsUser 未指定のため SYSTEM で登録します。" -ForegroundColor Yellow
    Write-Host "      共有フォルダ（UNC）にアクセスできない場合は、共有アクセス可能なユーザーで登録し直してください。" -ForegroundColor Yellow
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings `
        -Description "C:\backups を共有フォルダへ同期（robocopy）" -Force
} else {
    # 指定ユーザーで登録: パスワードを対話入力で取得（ログオンしていなくても実行・共有アクセス可）
    $cred = Get-Credential -UserName $RunAsUser -Message "タスク実行ユーザー '$RunAsUser' のパスワードを入力してください"
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
        -RunLevel Highest -Settings $settings `
        -Description "C:\backups を共有フォルダへ同期（robocopy）" -Force
}

Write-Host "OK: タスク '$taskName' を登録しました（毎日 $At 実行）" -ForegroundColor Green
