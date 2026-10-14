@echo off
title MaintainIQ Backend (Port 8000)
cd /d "%~dp0\.."
echo ============================================================
echo   MaintainIQ Enterprise v3.0 - FastAPI Backend Server
echo ============================================================
echo Root: %CD%
echo Port: 8000
echo.
node scripts\start-backend.cjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend exited with error code %ERRORLEVEL%.
    pause
)
