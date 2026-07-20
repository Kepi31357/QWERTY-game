@echo off
setlocal
cd /d "%~dp0"
title QWERTY + Ngrok (remote playtest)

echo.
echo  QWERTY — share outside your Wi-Fi via Ngrok
echo  See NGROK.md for install steps if this fails.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-with-ngrok.ps1"
if errorlevel 1 (
  echo.
  echo Could not start. Check the messages above and NGROK.md
  echo.
)

pause
