@echo off
:: These lines say always run as admin
set "params=%*"
cd /d "%~dp0" && ( if exist "%temp%\getadmin.vbs" del "%temp%\getadmin.vbs" ) && fsutil dirty query %systemdrive% 1>nul 2>nul || (  echo Set UAC = CreateObject^("Shell.Application"^) : UAC.ShellExecute "cmd.exe", "/k cd ""%~sdp0"" && ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs" && "%temp%\getadmin.vbs" && exit /B )

SET install_dir=C:\Program Files\Dashball
SET "startup_dir=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Installation for Dashball.

:: Check if Chocolatey is insalled
where /q choco
if %errorlevel% neq 0 (
    echo Chocolatey is installing...
    :: Download and install Chocolatey
    @"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))" && SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
)

:: Check again if Chocolatey is installed
where /q choco
if %errorlevel% neq 0 (
    echo Chocolatey installation failed.
    exit /b
)

:: Install wget with Chocolatey
echo wget is installing...
choco install wget -y

:: CHeck if wget is installed
where /q wget
if %errorlevel% neq 0 (
    echo wget installation failed.
    exit /b
)

echo wget is Installed

:: Check if python is installed
python --version 2>NUL
if %ERRORLEVEL% NEQ 0 goto installPython
exit /b

:installPython
echo Python is not found on your computer. Installing...

:: Download the Python installer with wget 
wget https://www.python.org/ftp/python/3.12.1/python-3.12.1-amd64.exe -OutFile python-installer.exe

:: Execute the python installer
start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1

:: Delete the installer
del python-installer.exe

:: Check if python is installed
python --version
if %ERRORLEVEL% NEQ 0 (
    echo Python installation failed.
    exit /b
)

echo Python succesvol geïnstalleerd.
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
