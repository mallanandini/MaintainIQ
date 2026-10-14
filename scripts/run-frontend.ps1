# MaintainIQ Enterprise v3.0 - Dedicated Frontend Console
$host.UI.RawUI.WindowTitle = "MaintainIQ Frontend (Port 3001)"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MaintainIQ Enterprise v3.0 - Frontend & Express Server   " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Root: $projectRoot" -ForegroundColor Gray
Write-Host "Port: 3001" -ForegroundColor Gray
Write-Host ""

node scripts/start-frontend.cjs
