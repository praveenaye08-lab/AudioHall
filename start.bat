@echo off
title AetherMic Local Walkie-Talkie
cd /d "%~dp0"

echo ==============================================================
echo             AETHERMIC LOCAL WI-FI WALKIE-TALKIE
echo ==============================================================
echo Starting local HTTPS server...
echo.

REM Add node to PATH if installed in user Programs
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

REM Check node
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Run server
node server.js
pause
