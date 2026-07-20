@echo off
cd /d "%~dp0"
title QWERTY Game Server

echo.
echo ========================================
echo   QWERTY - Starting game server...
echo ========================================
echo.
echo Keep this window OPEN while you play.
echo Your browser will open automatically.
echo.
echo Do NOT open index.html directly - use this bat file.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "18432,18433,18434,18435,18436,8766,8767 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 (
  echo.
  echo ERROR: Game server could not start.
  echo Close any other PowerShell windows and try again.
  echo.
  pause
)
