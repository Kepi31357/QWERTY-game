@echo off
setlocal
cd /d "%~dp0"
title QWERTY - Stop Online Server
echo.
echo Stopping any QWERTY server on port 3001...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-online-server.ps1"
if errorlevel 1 (
  echo.
  echo Port 3001 may still be busy. Close any black server windows manually.
) else (
  echo.
  echo Port 3001 is free. You can run OPEN ONLINE GAME.bat again.
)
echo.
pause
