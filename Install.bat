@echo off
:: These lines say always run as admin
set "params=%*"
cd /d "%~dp0" && ( if exist "%temp%\getadmin.vbs" del "%temp%\getadmin.vbs" ) && fsutil dirty query %systemdrive% 1>nul 2>nul || (  echo Set UAC = CreateObject^("Shell.Application"^) : UAC.ShellExecute "cmd.exe", "/k cd ""%~sdp0"" && ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs" && "%temp%\getadmin.vbs" && exit /B )

SET install_dir=C:\Program Files\Dashball
SET "startup_dir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Installation for Dashball.

:: install all requirements
pip install -r requirements.txt

:: Create the installation folder
 mkdir "%install_dir%"

:: Copy all files from files-to-copy.txt to the installation dir
for /f "tokens=*" %%i in (files-to-copy.txt) do (
    if not "%%i"=="" (
        if exist "%~dp0%%i" (
            xcopy /s /y "%~dp0%%i" "%install_dir%\%%i"
        ) else (
            echo Error: File %%i not found.
        )
    )
)


:: Create a shortcut with vbscript
copy "%~dp0\startup.bat" "%startup_dir%" /Y

:: Start the program
call startup.bat 

echo Instalation Finished. Now go monitor your things.
pause
