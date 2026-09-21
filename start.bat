@echo off
title NOC Portal - Aiven PostgreSQL Cloud Server
echo ===================================================================
echo   SBYIM NOC PORTAL - AUTOMATIC CLOUD DATABASE LAUNCHER
echo   Connecting to Aiven PostgreSQL Cloud Database Server...
echo ===================================================================

cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in system PATH.
    echo Please install Node.js from https://nodejs.org to run the NOC Backend Server.
    pause
    exit /b 1
)

:: Check if port 3000 is already active
netstat -ano | findstr /R ":3000.*LISTENING" >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] NOC Backend Server is already running on port 3000.
) else (
    echo [STARTING] Launching NOC Backend Server connected to Aiven Cloud...
    start /min "NOC Portal Server" node server.js
    :: Wait 2 seconds for server initialization
    timeout /t 2 /nobreak >nul
)

echo [OK] Opening SBYIM NOC Portal in your default browser...
start http://localhost:3000

echo ===================================================================
echo   NOC Portal is live: http://localhost:3000
echo   Aiven PostgreSQL Cloud Database is connected.
echo ===================================================================
exit /b 0
