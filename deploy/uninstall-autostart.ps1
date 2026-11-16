# Removes the auto-start task (run as administrator). The studio files are not touched.
& (Join-Path $PSScriptRoot 'stop-studio.ps1')
Unregister-ScheduledTask -TaskName 'AutoTubeStudio' -Confirm:$false
Write-Host 'Auto-start removed.'
