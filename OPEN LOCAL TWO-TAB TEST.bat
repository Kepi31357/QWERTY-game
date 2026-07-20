@echo off

setlocal

cd /d "%~dp0"

title QWERTY Online — Local Two-Tab Test



where node >nul 2>&1

if errorlevel 1 (

  echo Node.js is not installed or not on PATH.

  pause

  exit /b 1

)



if not exist "server\node_modules" (

  pushd server

  call npm install

  popd

)



powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"



echo.

echo Local test: opens HOST tab and GUEST tab on this computer.

echo For real devices use OPEN ONLINE GAME.bat + JOIN FRIEND GAME.bat

echo.



start "" "http://127.0.0.1:3001/"

start "" "http://127.0.0.1:3001/?guest"



node server\index.js

pause
