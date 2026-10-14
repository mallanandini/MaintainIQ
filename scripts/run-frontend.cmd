@echo off
title MaintainIQ Frontend (Port 3001)
cd /d "%~dp0\.."
echo ============================================================
echo   MaintainIQ Enterprise v3.0 - Frontend and Express Server
echo ============================================================
echo Root: %CD%
echo Port: 3001
echo.
call npx tsx server.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Frontend exited with error code %ERRORLEVEL%.
    pause
)
