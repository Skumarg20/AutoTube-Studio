# AutoTube Studio supervisor: keeps server.mjs running and restarts it if it stops.
# Started by the scheduled task "AutoTubeStudio" (deploy\install-autostart.ps1). You can also run it by hand:
#   powershell -ExecutionPolicy Bypass -File deploy\run-studio.ps1
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$log = Join-Path $root 'data\server.log'
$port = if ($env:PORT) { $env:PORT } else { 4747 }
New-Item -ItemType Directory -Force (Join-Path $root 'data') | Out-Null
function Say($m) { [IO.File]::AppendAllText($log, "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  supervisor: $m`r`n") }

# tools installed for this user only (Claude Code, ffmpeg via winget) are not always on PATH for a background task
foreach ($d in @("$env:USERPROFILE\.local\bin", "$env:APPDATA\npm", "$env:LOCALAPPDATA\Microsoft\WinGet\Links", 'C:\Program Files\nodejs', 'C:\Program Files\Git\bin', 'C:\ffmpeg\bin')) {
  if ((Test-Path $d) -and ($env:PATH -notlike "*$d*")) { $env:PATH = "$env:PATH;$d" }
}

$fast = 0
while ($true) {
  # already running (started by hand?): don't start a second copy
  try { Invoke-RestMethod "http://127.0.0.1:$port/healthz" -TimeoutSec 3 | Out-Null; Start-Sleep 60; continue } catch {}

  # keep the log small: server.log -> server.1.log ... server.5.log
  if ((Test-Path $log) -and ((Get-Item $log).Length -gt 20MB)) {
    for ($i = 4; $i -ge 1; $i--) { $a = Join-Path $root "data\server.$i.log"; if (Test-Path $a) { Move-Item -Force $a (Join-Path $root "data\server.$($i + 1).log") } }
    Move-Item -Force $log (Join-Path $root 'data\server.1.log')
  }
  Say "checking the machine (node tools/doctor.mjs)"
  cmd /c "node tools\doctor.mjs >> `"$log`" 2>&1"
  Say "starting AutoTube Studio"
  $t0 = Get-Date
  cmd /c "node server.mjs >> `"$log`" 2>&1"
  $code = $LASTEXITCODE
  # crash loop protection: wait longer each time it dies within 2 minutes
  if (((Get-Date) - $t0).TotalSeconds -lt 120) { $fast++ } else { $fast = 0 }
  $wait = [Math]::Min(600, 15 * [Math]::Pow(2, [Math]::Min($fast, 6)))
  Say "AutoTube Studio stopped (exit code $code). Restarting in $wait s."
  Start-Sleep $wait
}
