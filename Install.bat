@echo off
:: Always run as admin
set "params=%*"
cd /d "%~dp0" && ( if exist "%temp%\getadmin.vbs" del "%temp%\getadmin.vbs" ) && fsutil dirty query %systemdrive% 1>nul 2>nul || (  echo Set UAC = CreateObject^("Shell.Application"^) : UAC.ShellExecute "cmd.exe", "/k cd ""%~sdp0"" && ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs" && "%temp%\getadmin.vbs" && exit /B )

SET install_dir=C:\Program Files\Dashball
SET "startup_dir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
SET "vbscript=%temp%\temp_create_shortcut.vbs"

echo Installation for Dashball.

:: Create the installation folder
 mkdir "%install_dir%"

:: Copy all files to the installation dir
copy "%~dp0\app.py" "%install_dir%" /Y
copy "%~dp0\charts.js" "%install_dir%" /Y
copy "%~dp0\Dualz_logo.png" "%install_dir%" /Y
copy "%~dp0\index.html" "%install_dir%" /Y
copy "%~dp0\README.md" "%install_dir%" /Y
copy "%~dp0\startup.bat" "%install_dir%" /Y
mkdir "%install_dir%/styles"
copy "%~dp0\styles\styles.css" "%install_dir%\styles" /Y


:: Create a shortcut with vbscript
copy "%~dp0\startup.bat" "%startup_dir%" /Y

:: Start the program
call startup.bat 

echo Instalation Finished. Now go monitor your things.
pause