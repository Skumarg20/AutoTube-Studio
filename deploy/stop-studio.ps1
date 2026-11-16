# Stops AutoTube Studio (the supervisor, the server, its render worker and the Claude runs it started).
# Use it before updating the code; start again with:  Start-ScheduledTask AutoTubeStudio
$root = (Split-Path -Parent $PSScriptRoot)
try { Stop-ScheduledTask -TaskName 'AutoTubeStudio' -ErrorAction Stop } catch {}
$procs = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*run-studio.ps1*') -or
  ($_.Name -eq 'node.exe' -and $_.CommandLine -like '*server.mjs*' -and $_.CommandLine -notlike '*--server*')
}
foreach ($p in $procs) { Write-Host "stopping $($p.Name) $($p.ProcessId)"; taskkill /PID $p.ProcessId /T /F | Out-Null }
Write-Host 'AutoTube Studio stopped. Videos that were being made go back in the queue and are made again when it starts.'
