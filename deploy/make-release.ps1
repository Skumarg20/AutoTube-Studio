# Builds the PUBLIC release that anyone can install on their own Windows PC:
#   powershell -ExecutionPolicy Bypass -File deploy\make-release.ps1
# Output: Desktop\AutoTube-Studio-Setup\ (autotube-studio.zip, lemo-opuscar.zip, install.ps1, INSTALL.txt)
# Only the program goes in: NO channels, videos, ideas, settings, keys, voices, YouTube/Instagram sign-ins or logs.
# (deploy\make-package.ps1 is different: it moves YOUR studio with all its data to your own server.)
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$lib = (& node -e "import('file:///$($app.Replace('\','/'))/lib/store.js').then(m=>console.log(m.settings().libraryPath))").Trim()
if (-not (Test-Path "$lib\core\render\video.mjs")) { throw "Library not found at $lib" }
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'AutoTube-Studio-Setup'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null
$tmp = Join-Path $env:TEMP 'autotube-release'; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }; New-Item -ItemType Directory -Force $tmp | Out-Null

# ---- the studio: an allow-list of program files ----
$files = @('server.js', 'worker.js', 'package.json', 'package-lock.json', 'start.cmd', 'README.md', 'THEMES.md', 'DEPLOY.md', 'CLAUDE.md', 'dashboard\index.html',
           'config\.env.example', 'config\youtube_client.example.json', 'config\instagram.example.json')
$dirs = @('lib', 'engine', 'uploaders', 'template', 'deploy', 'dashboard\previews', 'tools')
$skip = '^(tools\\(rhubarb_dl|bin)\\|tools\\test_|tools\\ai_test|deploy\\make-package|deploy\\setup-server)|\.(bak|log)$|\.before'
$list = New-Object System.Collections.Generic.List[string]
foreach ($f in $files) { if (-not (Test-Path "$app\$f")) { throw "missing $f" }; $list.Add('autotube-studio/' + $f.Replace('\', '/')) }
foreach ($d in $dirs) {
  Get-ChildItem "$app\$d" -Recurse -File -Force | ForEach-Object {
    $r = $_.FullName.Substring($app.Length + 1)
    if ($r -match $skip) { return }
    $list.Add('autotube-studio/' + $r.Replace('\', '/'))
  }
}
# never ship personal files, even if one slipped into an allowed folder
$bad = $list | Where-Object { $_ -match '/(data|jobs|channels|node_modules)/|youtube_token|youtube_client\.json$|elevenlabs\.json$|settings\.json$|instagram\.json$|meta_pages|/\.env$' }
if ($bad) { throw "personal files in the release list: $($bad -join ', ')" }
[IO.File]::WriteAllLines("$tmp\app.txt", $list)
Write-Host "Studio: $($list.Count) program files. Zipping..."
Push-Location (Split-Path -Parent $app); tar -a -c -f "$out\autotube-studio.zip" -T "$tmp\app.txt"; Pop-Location

# ---- the Lemo Opuscar library (MIT licence, LICENSE file included) ----
$libParent = Split-Path -Parent $lib; $libName = Split-Path -Leaf $lib
$list2 = New-Object System.Collections.Generic.List[string]
Get-ChildItem $lib -Recurse -File -Force | ForEach-Object {
  $r = $_.FullName.Substring($lib.Length + 1)
  if ($r -like '.venv\*' -or $r -like 'node_modules\*' -or $r -like '.git\*') { return }
  # example films: only each film's own top-level code and notes (what the scene director reads), no tools/kits/renders
  if ($r -like 'films\*' -and ($r -notmatch '^films\\[^\\]+\\[^\\]+$' -or $_.Extension -notmatch '^\.(js|mjs|md|json|html|css|txt)$' -or $_.Length -gt 5MB)) { return }
  # never ship this PC's user folder (local paths written while films were rendered here)
  if ($_.Length -lt 5MB -and $_.Extension -match '^\.(js|mjs|md|json|html|css|txt|sh|py|log|ps1)$' -and (Select-String -Path $_.FullName -SimpleMatch -Pattern $env:USERNAME, $env:USERPROFILE.Replace('\', '/') -Quiet)) { $script:dropped++; if ($r -notlike "films*") { Write-Host "  WARNING left out (has a local path): $r" -ForegroundColor Yellow }; return }
  $list2.Add("$libName/" + $r.Replace('\', '/'))
}
if ($script:dropped) { Write-Host "  left out $script:dropped file(s) that contained this PC's user folder" }
if (-not ($list2 -contains "$libName/LICENSE")) { throw 'library LICENSE missing' }
[IO.File]::WriteAllLines("$tmp\lib.txt", $list2)
Write-Host "Library: $($list2.Count) files. Zipping..."
Push-Location $libParent; tar -a -c -f "$out\lemo-opuscar.zip" -T "$tmp\lib.txt"; Pop-Location

Copy-Item "$app\deploy\install.ps1" "$out\install.ps1" -Force
@"
AutoTube Studio - install
=========================
Faceless YouTube videos made by Claude on your own computer: you describe your channel, Claude researches ideas,
writes and directs each video in the Lemo Opuscar animation themes, your PC renders it, you approve, it uploads.

You need: Windows 10/11 (64-bit), 8+ CPU cores and 16 GB RAM recommended, 40 GB free disk, internet,
and a Claude account (Pro/Max plan) - or an Anthropic API key.

1. Unzip this folder anywhere (for example on the Desktop).
2. Start menu > type PowerShell > right-click "Windows PowerShell" > Run as administrator. Then type
   (change the folder if you put it elsewhere):
     cd `$HOME\Desktop\AutoTube-Studio-Setup
     powershell -ExecutionPolicy Bypass -File .\install.ps1
3. It installs everything it needs (Node.js, Python, FFmpeg, Git, Claude Code - about 30 minutes) and opens a
   Claude window once: sign in there, then type /exit.
4. The studio opens in your browser at http://localhost:4747. Next time, double-click "AutoTube Studio" on the desktop.

In the studio:
  - Channels > Add a channel: name, what it is about, audience, language, voice, how many videos.
  - Ideas: give a prompt; Claude researches and suggests titles. Approve a title, then the plan, then the video.
  - Uploading to YouTube is optional: Settings > Connections explains the free Google key (about 10 minutes, once).
    Without it, download the finished video from the Videos page.
  - Voices: free English voices are built in. For Hindi/Hinglish or your own cloned voice add an ElevenLabs key
    (Settings > Voice).

To run it on a server reachable from anywhere instead: install.ps1 -Server (adds a dashboard password and a free https link).
Animation themes: Lemo Opuscar by LemoLab, MIT licence (lemo-opuscar-main\LICENSE).
"@ | Set-Content "$out\INSTALL.txt" -Encoding UTF8
Remove-Item $tmp -Recurse -Force
Get-ChildItem $out | ForEach-Object { '{0,8:N0} MB  {1}' -f ($_.Length / 1MB), $_.Name }
Write-Host "Release ready: $out"
