# AutoTube Studio - the owner's server setup: India time zone, then the full server install (deploy\install.ps1 -Server).
# Run in PowerShell "Run as administrator" from the folder that holds the two zips and install.ps1:
#   powershell -ExecutionPolicy Bypass -File .\setup-server.ps1
$ErrorActionPreference = 'Stop'
Set-TimeZone -Id 'India Standard Time'
& (Join-Path $PSScriptRoot 'install.ps1') -Server
