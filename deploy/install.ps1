# AutoTube Studio - one-time install on any Windows 10/11 PC or Windows Server 2019/2022.
# Run in PowerShell opened with "Run as administrator", signed in as the Windows user who will use the studio,
# from the folder that holds autotube-studio.zip and lemo-opuscar.zip:
#   powershell -ExecutionPolicy Bypass -File .\install.ps1            (this PC: open the studio at http://localhost:4747)
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -Server    (a server: never sleeps, starts with Windows,
#                                                                      dashboard password + public https link)
# Safe to run again: it skips what is already installed. A log is written next to this script (install-log.txt).
param([switch]$Server)
$ErrorActionPreference = 'Stop'
$pkg = $PSScriptRoot
Start-Transcript -Path (Join-Path $pkg 'install-log.txt') -Append | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Open PowerShell with "Run as administrator" and run this again.' }
$app = Join-Path $HOME 'autotube-studio'
$libRoot = Join-Path $HOME 'lemo-opuscar-src'; $lib = Join-Path $libRoot 'lemo-opuscar-main'
$dl = Join-Path $env:TEMP 'autotube-setup'; New-Item -ItemType Directory -Force $dl | Out-Null
function Step($m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Have($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ";$HOME\.local\bin" }
function Get($url, $file) { $f = Join-Path $dl $file; if (-not (Test-Path $f)) { Write-Host "   downloading $url"; Invoke-WebRequest $url -OutFile $f -UseBasicParsing }; $f }
function Run($exe, $argList) { $p = Start-Process $exe -ArgumentList $argList -Wait -PassThru; if ($p.ExitCode -notin 0, 3010, 1638) { throw "$exe exited $($p.ExitCode)" } }
function SetEnvLine($file, $key, $value) {   # set KEY=value in config\.env, keeping every other line
  $lines = @(Get-Content $file); $hit = $false
  $lines = $lines | ForEach-Object { if ($_ -match "^\s*#?\s*$key=") { $hit = $true; "$key=$value" } else { $_ } }
  if (-not $hit) { $lines += "$key=$value" }
  Set-Content $file $lines -Encoding UTF8
}

if ($Server) {
  Step 'Server settings: never sleep'
  powercfg /change standby-timeout-ac 0; powercfg /change hibernate-timeout-ac 0; powercfg /change monitor-timeout-ac 0
}

Step 'Visual C++ runtime (needed by the voice and music tools)'
Run (Get 'https://aka.ms/vs/17/release/vc_redist.x64.exe' 'vc_redist.x64.exe') '/install /quiet /norestart'

RefreshPath
Step 'Node.js (LTS)'
if (-not (Have node)) {
  $v = ((Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts } | Select-Object -First 1).version
  Run 'msiexec.exe' "/i `"$(Get "https://nodejs.org/dist/$v/node-$v-x64.msi" "node-$v-x64.msi")`" /qn /norestart"
} else { Write-Host "   already installed: $(node --version)" }

Step 'Git for Windows (the sound mix uses its bash)'
if (-not (Test-Path 'C:\Program Files\Git\bin\bash.exe')) {
  $a = (Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{ 'User-Agent' = 'autotube-setup' }).assets | Where-Object { $_.name -match '^Git-[\d.]+-64-bit\.exe$' } | Select-Object -First 1
  Run (Get $a.browser_download_url $a.name) '/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES'
} else { Write-Host '   already installed' }

Step 'Python 3.12'
$py = 'C:\Program Files\Python312\python.exe'
if (-not (Test-Path $py)) { Run (Get 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' 'python-3.12.10-amd64.exe') '/quiet InstallAllUsers=1 PrependPath=1 Include_launcher=1 Include_test=0' } else { Write-Host '   already installed' }

Step 'FFmpeg'
if (-not (Test-Path 'C:\ffmpeg\bin\ffmpeg.exe')) {
  $z = Get 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' 'ffmpeg.zip'
  $x = Join-Path $dl 'ffmpeg-x'; if (Test-Path $x) { Remove-Item $x -Recurse -Force }; Expand-Archive $z $x
  $inner = Get-ChildItem $x -Directory | Select-Object -First 1
  New-Item -ItemType Directory -Force 'C:\ffmpeg' | Out-Null; Copy-Item "$($inner.FullName)\*" 'C:\ffmpeg' -Recurse -Force
} else { Write-Host '   already installed' }
$mp = [Environment]::GetEnvironmentVariable('Path', 'Machine')
foreach ($d in 'C:\ffmpeg\bin', 'C:\Program Files\Git\bin') { if ($mp -notlike "*$d*") { $mp = "$mp;$d" } }
[Environment]::SetEnvironmentVariable('Path', $mp, 'Machine'); RefreshPath

Step 'Claude Code (writes and directs every video)'
if (-not (Have claude)) { Invoke-RestMethod 'https://claude.ai/install.ps1' | Invoke-Expression; RefreshPath }
if (-not (Have claude)) { throw 'Claude Code did not install. Install it from https://claude.com/claude-code and run this again.' }
Write-Host "   $(claude --version)"

Step 'Unpacking AutoTube Studio and the Lemo Opuscar library'
if (Test-Path "$app\server.js") {
  Write-Host "   $app already exists: keeping it (rename it first to unpack a fresh copy)"
} else {
  if (-not (Test-Path "$pkg\autotube-studio.zip")) { throw "autotube-studio.zip not found next to this script ($pkg)" }
  tar -x -f "$pkg\autotube-studio.zip" -C $HOME
}
if (Test-Path "$lib\core\render\video.mjs") { Write-Host "   library already at $lib" } else {
  New-Item -ItemType Directory -Force $libRoot | Out-Null; tar -x -f "$pkg\lemo-opuscar.zip" -C $libRoot
}

Step 'Library packages, render browser and Python tools (this takes a while)'
Push-Location $lib
npm install --no-audit --no-fund
node node_modules\playwright-core\cli.js install chromium
if (-not (Test-Path '.venv\Scripts\python.exe')) { & $py -m venv .venv }
& .venv\Scripts\python.exe -m pip install --upgrade pip
$req = @('requirements.txt', 'requirements-voice.txt', 'requirements-music.txt') | Where-Object { Test-Path $_ } | ForEach-Object { '-r', $_ }
& .venv\Scripts\python.exe -m pip install @req
Pop-Location
Push-Location $app
npm install --no-audit --no-fund
node -e "import('./lib/store.js').then(m=>{m.saveSettings({libraryPath: process.argv[1]});console.log('   libraryPath = '+process.argv[1])})" $lib
if (-not (Test-Path 'config\.env')) { Copy-Item 'config\.env.example' 'config\.env'; Write-Host '   created config\.env (optional keys and settings; edit it any time)' }
if ($Server) {
  SetEnvLine 'config\.env' 'HS_TUNNEL' 'quick'
  if (-not (Test-Path 'tools\bin\cloudflared.exe')) {
    New-Item -ItemType Directory -Force 'tools\bin' | Out-Null
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'tools\bin\cloudflared.exe' -UseBasicParsing
  }
} else { SetEnvLine 'config\.env' 'HS_TUNNEL' 'off' }
Pop-Location

Step 'Sign in to Claude (once)'
$cred = Join-Path $HOME '.claude\.credentials.json'
if (-not (Test-Path $cred) -and -not $env:ANTHROPIC_API_KEY) {
  Write-Host '   A new window opens with Claude Code. Sign in there (it opens the browser), then type /exit in that window.' -ForegroundColor Yellow
  Write-Host '   (No Claude subscription? Put an API key in config\.env as ANTHROPIC_API_KEY instead.)' -ForegroundColor Yellow
  Start-Process powershell -ArgumentList '-NoExit', '-Command', 'claude' -Wait
  if (-not (Test-Path $cred)) { Write-Host '   No Claude login found yet. Run "claude" later and sign in; the studio waits for it.' -ForegroundColor Yellow } else { Write-Host '   signed in' }
} else { Write-Host '   already signed in' }

Push-Location $app
if ($Server) {
  Step 'Dashboard password (protects the public link)'
  $hasPw = node -e "import('./lib/ops.js').then(m=>console.log(m.loginOn()))"
  if ($hasPw.Trim() -ne 'true') { node tools\set-password.js } else { Write-Host '   already set (change it with: node tools\set-password.js)' }
}
Step 'Checking this computer'
node tools\doctor.js
Pop-Location

# a desktop shortcut that starts the studio (or just opens it when it already runs)
$desk = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell; $lnk = $ws.CreateShortcut((Join-Path $desk 'AutoTube Studio.lnk'))
$lnk.TargetPath = Join-Path $app 'start.cmd'; $lnk.WorkingDirectory = $app; $lnk.Description = 'Start AutoTube Studio'; $lnk.Save()

if ($Server) {
  Step 'Starting AutoTube Studio with Windows (scheduled task "AutoTubeStudio")'
  & (Join-Path $app 'deploy\install-autostart.ps1')
  Step 'Waiting for the public link'
  $urlFile = Join-Path $app 'data\public-url.txt'
  for ($i = 0; $i -lt 60 -and -not (Test-Path $urlFile); $i++) { Start-Sleep 3 }
  if (Test-Path $urlFile) {
    $u = (Get-Content $urlFile -TotalCount 1).Trim()
    Write-Host ''; Write-Host "AutoTube Studio is live:  $u" -ForegroundColor Green
    Write-Host 'Open it from any device and sign in with the dashboard password.'
    Write-Host 'The free link changes when the server restarts; the current one is always on this desktop ("AutoTube Studio link") and in data\public-url.txt.'
    Start-Process $u
  } else { Write-Host "The studio started, but no public link yet. Look at $app\data\server.log" -ForegroundColor Yellow }
} else {
  Step 'Starting AutoTube Studio'
  # start it as the normal (not administrator) user, the same way the desktop shortcut does
  Start-Process explorer.exe (Join-Path $app 'start.cmd')
  Write-Host ''; Write-Host 'AutoTube Studio is installed. It opens at http://localhost:4747' -ForegroundColor Green
  Write-Host 'Next time, double-click "AutoTube Studio" on the desktop. Keep its window open while videos are being made.'
  Write-Host 'In the dashboard: add your channel, then go to Ideas and give a prompt.'
}
Stop-Transcript | Out-Null
