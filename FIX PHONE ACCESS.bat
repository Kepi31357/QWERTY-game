@echo off

setlocal

cd /d "%~dp0"

title QWERTY - Fix Phone Access



echo.

echo This adds a Windows Firewall rule so phones on your Wi-Fi can reach the game.

echo Administrator permission is required.

echo.



net session >nul 2>&1

if errorlevel 1 (

  echo Requesting administrator permission...

  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"

  exit /b 0

)



echo Running as administrator...

echo.



netsh advfirewall firewall delete rule name="QWERTY Online" >nul 2>&1

netsh advfirewall firewall add rule name="QWERTY Online" dir=in action=allow protocol=TCP localport=3001 profile=private,public



if errorlevel 1 (

  echo ERROR: Could not add firewall rule.

) else (

  echo SUCCESS: Port 3001 is now allowed through Windows Firewall.

)



echo.

echo Also check:

echo   - Turn OFF VPN (NordVPN etc.) on the host PC while playing

echo   - Phone must be on the SAME Wi-Fi (not cellular data)

echo   - Use the 192.168.x.x link from the server window, not 127.0.0.1

echo.



pause
