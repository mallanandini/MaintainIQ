# MaintainIQ Enterprise v3.0 — Stable Local Development Startup Script
$root = (Get-Location).Path
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MaintainIQ Enterprise v3.0 - Local Development Launcher  " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Working Directory: $root" -ForegroundColor Gray
Write-Host ""

# 1. Environment & Prerequisites Verification
Write-Host "[1/5] Checking Required Tools..." -ForegroundColor Yellow

# Node.js
try {
    $nodeVer = node -v
    Write-Host "      [OK] Node.js is installed ($nodeVer)." -ForegroundColor Green
} catch {
    Write-Host "      [FATAL] Node.js is not found in PATH. Please install Node.js v20+." -ForegroundColor Red
    exit 1
}

# npm
try {
    $npmVer = npm -v
    Write-Host "      [OK] npm is installed (v$npmVer)." -ForegroundColor Green
} catch {
    Write-Host "      [FATAL] npm is not found in PATH." -ForegroundColor Red
    exit 1
}

# Python Virtual Environment (.venv)
$pyExe = Join-Path $root ".venv\Scripts\python.exe"
if (Test-Path $pyExe) {
    $pyVer = & $pyExe -V
    Write-Host "      [OK] Python virtual environment found: $pyVer" -ForegroundColor Green
} else {
    Write-Host "      [FATAL] Virtual environment not found at .venv\Scripts\python.exe." -ForegroundColor Red
    exit 1
}

# 2. Database Connectivity Probe
Write-Host ""
Write-Host "[2/5] Checking MySQL Service and Database Connectivity..." -ForegroundColor Yellow

$mysqlService = Get-Service -Name "MySQL*", "mysql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($mysqlService) {
    if ($mysqlService.Status -ne 'Running') {
        Write-Host "      [INFO] Service '$($mysqlService.Name)' is stopped. Starting service..." -ForegroundColor Yellow
        try {
            Start-Service -Name $mysqlService.Name -ErrorAction Stop
            Write-Host "      [OK] Windows Service '$($mysqlService.Name)' started." -ForegroundColor Green
        } catch {
            Write-Host "      [WARN] Could not start service '$($mysqlService.Name)'." -ForegroundColor Yellow
        }
    } else {
        Write-Host "      [OK] Windows Service '$($mysqlService.Name)' is RUNNING." -ForegroundColor Green
    }
}

$probeScript = Join-Path $root "scripts\probe_db.py"
$dbProbe = & $pyExe $probeScript
if ($dbProbe -eq "CONNECTED") {
    Write-Host "      [OK] MySQL database connection verified (SELECT 1 query passed)." -ForegroundColor Green
} else {
    Write-Host "      [FATAL] MySQL database is unreachable: $dbProbe" -ForegroundColor Red
    exit 1
}

# 3. Port & Service Inspection (Avoid Duplicate Instances)
Write-Host ""
Write-Host "[3/5] Inspecting Ports and Active Instances..." -ForegroundColor Yellow

$backendConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$backendAlreadyRunning = $false
if ($backendConn) {
    try {
        $bHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($bHealth.status -eq 'ok') {
            $backendAlreadyRunning = $true
            Write-Host "      [OK] FastAPI backend is ALREADY RUNNING on port 8000 (PID: $($backendConn.OwningProcess)). Skipping duplicate launch." -ForegroundColor Green
        }
    } catch {
        Write-Host "      [WARN] Port 8000 is occupied but not responding to health probe." -ForegroundColor Yellow
    }
}

$frontendConn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$frontendAlreadyRunning = $false
if ($frontendConn) {
    try {
        $fHealth = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($fHealth.status -eq 'ok') {
            $frontendAlreadyRunning = $true
            Write-Host "      [OK] Frontend server is ALREADY RUNNING on port 3001 (PID: $($frontendConn.OwningProcess)). Skipping duplicate launch." -ForegroundColor Green
        }
    } catch {
        Write-Host "      [WARN] Port 3001 is occupied but not responding to health probe." -ForegroundColor Yellow
    }
}

# 4. Launch Missing Services in Independent Terminals
Write-Host ""
Write-Host "[4/5] Launching Services in Independent Terminal Windows..." -ForegroundColor Yellow

if (-not $backendAlreadyRunning) {
    Write-Host "      [START] Launching FastAPI Backend in dedicated terminal window..." -ForegroundColor Cyan
    $bScript = Join-Path $root "scripts\run-backend.ps1"
    Start-Process powershell.exe -WorkingDirectory $root -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-File", "`"$bScript`""
    Start-Sleep -Seconds 2
}

if (-not $frontendAlreadyRunning) {
    Write-Host "      [START] Launching Frontend/Express Server in dedicated terminal window..." -ForegroundColor Cyan
    $fScript = Join-Path $root "scripts\run-frontend.ps1"
    Start-Process powershell.exe -WorkingDirectory $root -ArgumentList "-ExecutionPolicy", "Bypass", "-NoExit", "-File", "`"$fScript`""
    Start-Sleep -Seconds 2
}

# 5. Health Verification & Summary
Write-Host ""
Write-Host "[5/5] Verifying Service Health..." -ForegroundColor Yellow

$retries = 8
$backendReady = $false
$frontendReady = $false

for ($i = 1; $i -le $retries; $i++) {
    Start-Sleep -Seconds 1
    if (-not $backendReady) {
        try {
            $bh = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($bh.status -eq 'ok') { $backendReady = $true }
        } catch {}
    }
    if (-not $frontendReady) {
        try {
            $fh = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($fh.status -eq 'ok') { $frontendReady = $true }
        } catch {}
    }
    if ($backendReady -and $frontendReady) { break }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       MaintainIQ Enterprise v3.0 - Services Online!        " -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend Application : " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Interactive API Docs : " -NoNewline; Write-Host "http://localhost:3001/docs" -ForegroundColor Cyan
Write-Host "  FastAPI Backend API  : " -NoNewline; Write-Host "http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  MySQL Database       : " -NoNewline; Write-Host "localhost:3306 (Running)" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend Health       : " -NoNewline
if ($backendReady) { Write-Host "ONLINE (HTTP 200)" -ForegroundColor Green } else { Write-Host "STARTING / PENDING" -ForegroundColor Yellow }

Write-Host "  Frontend Health      : " -NoNewline
if ($frontendReady) { Write-Host "ONLINE (HTTP 200)" -ForegroundColor Green } else { Write-Host "STARTING / PENDING" -ForegroundColor Yellow }
Write-Host ""
Write-Host "Tip: The services are running in independent Windows terminal windows." -ForegroundColor Gray
Write-Host "     They will remain active and stable while Antigravity works on the project." -ForegroundColor Gray
Write-Host "     To stop the services at any time, run '.\stop-dev.ps1'." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
