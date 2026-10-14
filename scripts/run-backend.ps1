# MaintainIQ Enterprise v3.0 - Dedicated Backend Console
$host.UI.RawUI.WindowTitle = "MaintainIQ Backend (Port 8000)"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MaintainIQ Enterprise v3.0 - FastAPI Backend Server      " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Root: $projectRoot" -ForegroundColor Gray
Write-Host "Port: 8000" -ForegroundColor Gray
Write-Host ""

node scripts/start-backend.cjs
