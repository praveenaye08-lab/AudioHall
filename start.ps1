# AetherMic PowerShell Launcher
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;$env:PATH"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Node.js is not found in PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org"
    Read-Host "Press Enter to exit..."
    exit 1
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "            AETHERMIC LOCAL WI-FI WALKIE-TALKIE" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Cyan

& node server.js
