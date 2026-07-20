@echo off
setlocal
cd /d "%~dp0"
title QWERTY Online Server

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-online-game.ps1"
if errorlevel 1 (
  echo.
  echo The server could not start. See the message above.
  echo Run STOP ONLINE SERVER.bat, then try OPEN ONLINE GAME.bat again.
  echo.
)

pause
