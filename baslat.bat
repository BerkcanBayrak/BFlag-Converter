@echo off
chcp 65001 > nul
title BFlag Converter - YouTube Video ^& MP3 Donusturucu (Copyright by Berkcan Bayrak)
cls

echo ================================================================
echo      BFlag Converter - YouTube Video ^& MP3 Donusturucu
echo      Copyright by Berkcan Bayrak
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/3] Python kontrol ediliyor...
python --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=python"
    goto :START_APP
)

py --version >nul 2>&1
if not errorlevel 1 (
    set "PY_CMD=py"
    goto :START_APP
)

echo.
echo [HATA] Python bu bilgisayarda kurulu bulunamadi veya PATH'e eklenmemis!
echo Lutfen https://www.python.org/ adresinden Python'u indirip kurun.
echo Kurulum yaparken "Add python.exe to PATH" kutucugunu isaretleyin.
echo.
pause
exit /b 1

:START_APP
echo [2/3] FFmpeg ve bagimliliklar hazirlaniyor...
%PY_CMD% setup_ffmpeg.py
%PY_CMD% -m pip install -r requirements.txt --quiet --disable-pip-version-check

echo.
echo [3/3] BFlag Converter baslatiliyor ve tarayici aciliyor...
echo.
%PY_CMD% run.py

if errorlevel 1 (
    echo.
    echo [!] Uygulama calisirken bir sorun olustu.
    pause
)
