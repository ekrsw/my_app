<#
.SYNOPSIS
  日次バックアップをタスクスケジューラへ登録する（管理者権限で実行すること）

.DESCRIPTION
  backup-db.ps1 を毎日 02:00 に SYSTEM アカウントで実行するタスクを作成する。
  「管理者として実行」した PowerShell から本スクリプトを実行する。

.NOTES
  実行例（管理者 PowerShell）:
    powershell -ExecutionPolicy Bypass -File .\scripts\backup\register-task.ps1
#>

$ErrorActionPreference = "Stop"

# 管理者権限チェック
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "エラー: 管理者権限が必要です。PowerShell を『管理者として実行』してから再実行してください。" -ForegroundColor Red
    exit 1
}

$scriptPath = Join-Path $PSScriptRoot "backup-db.ps1"
$taskName   = "ShiftDB-DailyBackup"

if (-not (Test-Path $scriptPath)) { throw "backup-db.ps1 が見つかりません: $scriptPath" }

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00am
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd `
    -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings `
    -Description "shift_database の日次バックアップ（pg_dump + .env退避 + 14日世代管理）" -Force

Write-Host "OK: タスク '$taskName' を登録しました（毎日 02:00 / SYSTEM 実行）" -ForegroundColor Green
