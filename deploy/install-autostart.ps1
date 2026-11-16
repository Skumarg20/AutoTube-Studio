# Run ONCE on the VM, in PowerShell "Run as administrator", while signed in as the Windows user that is signed in to Claude Code:
#   powershell -ExecutionPolicy Bypass -File deploy\install-autostart.ps1
# It makes AutoTube Studio start when Windows starts (even before anyone signs in), restart if it stops,
# and stops the VM from sleeping. Remove with deploy\uninstall-autostart.ps1.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Open PowerShell with "Run as administrator" and run this again.' }
$user = "$env:USERDOMAIN\$env:USERNAME"

# never sleep / hibernate (renders run for hours)
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change standby-timeout-dc 0

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $root `
  -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\deploy\run-studio.ps1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
# S4U = runs as you, whether or not you are signed in, without storing your Windows password
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'AutoTubeStudio' -Action $action -Trigger $trigger -Principal $principal -Settings $set -Force | Out-Null
Start-ScheduledTask -TaskName 'AutoTubeStudio'
Write-Host "Installed. AutoTube Studio now starts with Windows as $user and restarts itself if it stops."
Write-Host "Log: $root\data\server.log    Health: http://127.0.0.1:4747/healthz"
Write-Host "Stop it with:  powershell -ExecutionPolicy Bypass -File deploy\stop-studio.ps1"
