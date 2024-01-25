@echo off
SET install_dir=C:\Program Files\Dashball
SET "startup_dir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
SET "vbscript=%temp%\temp_create_shortcut.vbs"

echo Installation for Dashball.

:: Create the installation folder
if not exist "%install_dir%" (
    mkdir "%install_dir%"
) else (
    echo Installation dir already exists.
)

:: Copy all files to the installation dir
xcopy /e /i /y .\* "%install_dir%"

:: Maak een VBScript bestand om de snelkoppeling te maken
> "%vbscript%" echo Set oWS = WScript.CreateObject("WScript.Shell") 
>> "%vbscript%" echo sLinkFile = "%startup_dir%\DashballApp.lnk"
>> "%vbscript%" echo Set oLink = oWS.CreateShortcut(sLinkFile)
>> "%vbscript%" echo oLink.TargetPath = "%install_dir%\app.py" 
>> "%vbscript%" echo oLink.Save

:: Voer het VBScript uit om de snelkoppeling te maken
cscript //nologo "%vbscript%"

:: Ruim het VBScript bestand op
del "%vbscript%"

echo Instalation Finished. Now go monitor your things.
pause