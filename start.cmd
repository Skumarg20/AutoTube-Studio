@echo off
rem AutoTube Studio - double-click to start. The dashboard opens in your browser (http://localhost:4747 unless
rem config\.env sets another PORT). Keep this window open while videos are being made (closing it stops the studio).
cd /d "%~dp0"
set PORT=4747
if exist config\.env for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PORT=" config\.env') do if not "%%b"=="" set PORT=%%b
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:%PORT%/healthz -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  exit /b
)
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 5; Start-Process http://localhost:%PORT%"
title AutoTube Studio - keep this window open
node server.mjs
pause
