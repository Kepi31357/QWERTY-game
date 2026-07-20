@echo off

setlocal

cd /d "%~dp0"

title QWERTY - Join Friend's Game



echo.

echo ========================================

echo   QWERTY - Join a Friend's Online Game

echo ========================================

echo.

echo Deb (host) must run OPEN ONLINE GAME.bat first and keep that window open.

echo.

echo Ask Deb for the network address from her server window, for example:

echo   http://192.168.1.5:3001/

echo.

echo Or use the link Deb copied after Create Game (includes the friend code).

echo.

echo Enter only the IP numbers (example: 192.168.1.5)

echo Leave blank if Deb sent you a full link — paste it in your browser instead.

echo.

set /p HOST=Host IP address: 



if "%HOST%"=="" (

  echo.

  echo No IP entered.

  echo Paste Deb's full link into your browser, or run this again with her IP.

  pause

  exit /b 1

)



echo.

echo Opening http://%HOST%:3001/?guest in your browser...

echo Enter Deb's friend code on the menu if it is not filled in already.

echo.



start "" "http://%HOST%:3001/?guest"



pause
