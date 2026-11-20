# Builds the deployment package on THIS machine (the laptop):
#   powershell -ExecutionPolicy Bypass -File deploy\make-package.ps1
# Output: Desktop\AutoTube-deploy\  (autotube-studio.zip, lemo-opuscar.zip, setup-server.ps1, READ-ME-FIRST.txt)
# Leaves out what the server rebuilds or never needs: node_modules, the Python .venv, rendered example films,
# published/rejected videos and every video's out\ work folder.
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
$home2 = Split-Path -Parent $app
$lib = (& node -e "import('file:///$($app.Replace('\','/'))/lib/store.js').then(m=>console.log(m.settings().libraryPath))").Trim()
if (-not (Test-Path "$lib\core\render\video.mjs")) { throw "Library not found at $lib" }
$out = Join-Path ([Environment]::GetFolderPath('Desktop')) 'AutoTube-deploy'
New-Item -ItemType Directory -Force $out | Out-Null
$tmp = Join-Path $env:TEMP "autotube-pack"; New-Item -ItemType Directory -Force $tmp | Out-Null

function Rel($base, $full) { $full.Substring($base.Length + 1).Replace('\', '/') }

# ---- the studio ----
Write-Host 'Listing studio files...'
$skipDirs = @('node_modules', 'jobs', 'preview5min', 'tools\rhubarb_dl', 'data\backups', 'data\commons-cache', 'data\owntest')
$db = Get-Content "$app\data\db.json" -Raw | ConvertFrom-Json
$keepJobs = @($db.jobs | Where-Object { $_.status -notin 'published', 'rejected' } | ForEach-Object { $_.id })
$list = New-Object System.Collections.Generic.List[string]
Get-ChildItem $app -Recurse -File -Force | ForEach-Object {
  $r = $_.FullName.Substring($app.Length + 1)
  foreach ($d in $skipDirs) { if ($r -like "$d\*") { return } }
  if ($r -like 'data\*.before*' -or $r -like 'data\server*.log' -or $r -eq 'config\.env' -or $r -like 'dashboard\index.*.html' -or $r -like '*.bak') { return }
  $list.Add('autotube-studio/' + $r.Replace('\', '/'))
}
foreach ($id in $keepJobs) {
  $d = "$app\jobs\$id"; if (-not (Test-Path $d)) { continue }
  Get-ChildItem $d -Recurse -File -Force | Where-Object { $_.FullName -notlike "$d\out\*" } | ForEach-Object { $list.Add('autotube-studio/' + $_.FullName.Substring($app.Length + 1).Replace('\', '/')) }
}
[IO.File]::WriteAllLines("$tmp\app.txt", $list)
Write-Host "  $($list.Count) files ($($keepJobs.Count) unfinished videos). Zipping..."
Push-Location $home2; tar -a -c -f "$out\autotube-studio.zip" -T "$tmp\app.txt"; Pop-Location

# ---- the Lemo Opuscar library ----
Write-Host 'Listing library files...'
$libParent = Split-Path -Parent $lib; $libName = Split-Path -Leaf $lib
$media = '^\.(mp4|mov|webm|mkv|wav|mp3|m4a|aac|flac|exr|npy)$'
$list2 = New-Object System.Collections.Generic.List[string]
Get-ChildItem $lib -Recurse -File -Force | ForEach-Object {
  $r = $_.FullName.Substring($lib.Length + 1)
  if ($r -like '.venv\*' -or $r -like 'node_modules\*' -or $r -like '.git\*') { return }
  # example films: the scene director only reads their source code (main.js, plates.js, notes), never their pictures or renders
  if ($r -like 'films\*' -and ($_.Extension -notmatch '^\.(js|mjs|md|json|html|css|txt)$' -or $_.Length -gt 5MB -or $r -match '\\(out|frames|renders?)\\')) { return }
  $list2.Add("$libName/" + $r.Replace('\', '/'))
}
[IO.File]::WriteAllLines("$tmp\lib.txt", $list2)
Write-Host "  $($list2.Count) files. Zipping..."
Push-Location $libParent; tar -a -c -f "$out\lemo-opuscar.zip" -T "$tmp\lib.txt"; Pop-Location

Copy-Item "$app\deploy\setup-server.ps1" "$out\setup-server.ps1" -Force
Copy-Item "$app\deploy\install.ps1" "$out\install.ps1" -Force
@"
AutoTube Studio - server setup
==============================
1. Copy this whole AutoTube-deploy folder to the server (Remote Desktop: copy here, paste on the server's Desktop).
2. On the server: Start menu > Windows PowerShell > right-click > Run as administrator, then:
     cd `$HOME\Desktop\AutoTube-deploy
     powershell -ExecutionPolicy Bypass -File .\setup-server.ps1
3. It installs everything, asks you to sign in to Claude and to choose a dashboard password, then starts the studio
   and shows the public link. The link is also on the server's desktop as "AutoTube Studio link".
4. When it works, delete the two .zip files on the server and here: they contain your API keys and YouTube sign-ins.
"@ | Set-Content "$out\READ-ME-FIRST.txt" -Encoding UTF8
Remove-Item $tmp -Recurse -Force
Get-ChildItem $out | ForEach-Object { '{0,8:N0} MB  {1}' -f ($_.Length / 1MB), $_.Name }
Write-Host "Package ready: $out"
