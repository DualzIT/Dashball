@echo off
SET install_dir=C:\Program Files\Dashball

echo Installation for Dashball.

:: Create the installation folder
if not exist "%install_dir%" (
    mkdir "%install_dir%"
) else (
    echo Installation dir already exists.
)

:: Copy all files to the installation dir
xcopy /e /i /y .\* "%install_dir%"

:: Create a shortcut to windows startup
SET startup_dir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy "%install_dir%\app.py.lnk" "%startup_dir%"

echo Instalation Finished. Now go monitor your things.
pause
