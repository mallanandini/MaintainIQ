# MaintainIQ Enterprise v3.0 — Comprehensive Health Verification Script
$root = (Get-Location).Path
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MaintainIQ Enterprise v3.0 - System Health Diagnostic    " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host ""

$overallSuccess = $true

# 1. Database Verification
Write-Host "[1/4] Verifying MySQL Database Service..." -ForegroundColor Yellow
$mysqlService = Get-Service -Name "MySQL*", "mysql*" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($mysqlService) {
    if ($mysqlService.Status -eq 'Running') {
        Write-Host "      [OK] Windows Service '$($mysqlService.Name)' is RUNNING." -ForegroundColor Green
    } else {
        Write-Host "      [WARN] Service '$($mysqlService.Name)' is $($mysqlService.Status). Attempting start..." -ForegroundColor Yellow
        try {
            Start-Service -Name $mysqlService.Name -ErrorAction Stop
            Write-Host "      [OK] Service '$($mysqlService.Name)' started successfully." -ForegroundColor Green
        } catch {
            Write-Host "      [ERROR] Could not start service '$($mysqlService.Name)'." -ForegroundColor Red
            $overallSuccess = $false
        }
    }
} else {
    Write-Host "      [INFO] Checking database connectivity via probe script..." -ForegroundColor Gray
}

$pyExe = Join-Path $root ".venv\Scripts\python.exe"
$probeScript = Join-Path $root "scripts\probe_db.py"

if (Test-Path $pyExe) {
    $dbResult = & $pyExe $probeScript
    if ($dbResult -eq "CONNECTED") {
        Write-Host "      [OK] MySQL database connection verified (SELECT 1 passed)." -ForegroundColor Green
    } else {
        Write-Host "      [FAIL] MySQL database probe failed: $dbResult" -ForegroundColor Red
        $overallSuccess = $false
    }
} else {
    Write-Host "      [WARN] Virtual environment not found at $pyExe" -ForegroundColor Yellow
    $overallSuccess = $false
}

# 2. FastAPI Backend Service (Port 8000)
Write-Host ""
Write-Host "[2/4] Verifying FastAPI Backend (Port 8000)..." -ForegroundColor Yellow

$backendConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $backendConn) {
    Write-Host "      [FAIL] No process listening on Port 8000 (FastAPI is NOT running)." -ForegroundColor Red
    $overallSuccess = $false
} else {
    $proc = Get-Process -Id $backendConn.OwningProcess -ErrorAction SilentlyContinue
    $pName = if ($proc) { $proc.ProcessName } else { "Unknown" }
    Write-Host "      [OK] Port 8000 is open (Process: $pName, PID: $($backendConn.OwningProcess))." -ForegroundColor Green

    try {
        $backendHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        Write-Host "      [OK] Backend health: status=$($backendHealth.status), database=$($backendHealth.database)" -ForegroundColor Green
    } catch {
        Write-Host "      [FAIL] Port 8000 is open, but HTTP GET /api/health failed." -ForegroundColor Red
        $overallSuccess = $false
    }
}

# 3. Frontend & Express Reverse Proxy (Port 3001)
Write-Host ""
Write-Host "[3/4] Verifying Frontend and Express Proxy (Port 3001)..." -ForegroundColor Yellow

$frontendConn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $frontendConn) {
    Write-Host "      [FAIL] No process listening on Port 3001 (Frontend server is NOT running)." -ForegroundColor Red
    $overallSuccess = $false
} else {
    $proc = Get-Process -Id $frontendConn.OwningProcess -ErrorAction SilentlyContinue
    $pName = if ($proc) { $proc.ProcessName } else { "Unknown" }
    Write-Host "      [OK] Port 3001 is open (Process: $pName, PID: $($frontendConn.OwningProcess))." -ForegroundColor Green

    try {
        $htmlRes = Invoke-WebRequest -Uri "http://localhost:3001/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($htmlRes.StatusCode -eq 200) {
            Write-Host "      [OK] Frontend root URL (http://localhost:3001/) returns HTTP 200 OK." -ForegroundColor Green
        }
    } catch {
        Write-Host "      [FAIL] Could not reach http://localhost:3001/." -ForegroundColor Red
        $overallSuccess = $false
    }

    try {
        $proxyRes = Invoke-RestMethod -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
        Write-Host "      [OK] Express reverse proxy to FastAPI is working (status=$($proxyRes.status))." -ForegroundColor Green
    } catch {
        Write-Host "      [FAIL] Express reverse proxy failed." -ForegroundColor Red
        $overallSuccess = $false
    }
}

# 4. Live Data API Route Verification
Write-Host ""
Write-Host "[4/4] Verifying Live API Data Retrieval..." -ForegroundColor Yellow
try {
    $techs = Invoke-RestMethod -Uri "http://localhost:3001/api/technicians" -Method Get -TimeoutSec 4 -ErrorAction Stop
    $wos = Invoke-RestMethod -Uri "http://localhost:3001/api/work-orders?page_size=5" -Method Get -TimeoutSec 4 -ErrorAction Stop
    Write-Host "      [OK] /api/technicians returned $($techs.Count) technicians." -ForegroundColor Green
    Write-Host "      [OK] /api/work-orders returned $($wos.Count) work orders." -ForegroundColor Green
} catch {
    Write-Host "      [FAIL] Live data query failed: $($_.Exception.Message)" -ForegroundColor Red
    $overallSuccess = $false
}

Write-Host ""
Write-Host "------------------------------------------------------------" -ForegroundColor Gray
if ($overallSuccess) {
    Write-Host "OVERALL STATUS: HEALTHY (All services active and responding)" -ForegroundColor Green
    Write-Host "Application URL: http://localhost:3001" -ForegroundColor Cyan
    Write-Host "API Swagger URL: http://localhost:3001/docs" -ForegroundColor Cyan
} else {
    Write-Host "OVERALL STATUS: DEGRADED OR OFFLINE" -ForegroundColor Red
    Write-Host "Run '.\start-dev.ps1' to start missing services." -ForegroundColor Yellow
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
