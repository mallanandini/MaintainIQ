# MaintainIQ Enterprise v3.0 — Graceful Development Server Shutdown Script
$root = (Get-Location).Path

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   MaintainIQ Enterprise v3.0 - Stopping Development Servers" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stop processes listening on Port 3001 and Port 8000 (and their child forks via taskkill /T)
$ports = @(3001, 8000)
foreach ($port in $ports) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($c in $conns) {
            $pId = $c.OwningProcess
            if ($pId -and $pId -ne 0 -and $pId -ne 4) {
                Write-Host "  [STOP] Terminating socket owner and process tree on Port $port (PID: $pId)..." -ForegroundColor Yellow
                cmd.exe /c "taskkill /F /T /PID $pId 2>nul" | Out-Null
            }
        }
    } catch {
        # continue silently
    }
}

# 2. Terminate any lingering Uvicorn multiprocessing worker forks or launcher processes
try {
    $pyProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.Name -match "^python") -and (
            $_.CommandLine -match "multiprocessing\.spawn" -or
            $_.CommandLine -match "uvicorn" -or
            $_.CommandLine -match "start-backend"
        )
    }
    foreach ($p in $pyProcs) {
        Write-Host "  [CLEANUP] Stopping lingering Python worker (PID: $($p.ProcessId))..." -ForegroundColor Yellow
        cmd.exe /c "taskkill /F /PID $($p.ProcessId) 2>nul" | Out-Null
    }
} catch {
    # continue silently
}

# 3. Terminate any lingering Node/tsx server.ts processes
try {
    $nodeProcs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.Name -match "^node") -and ($_.CommandLine -match "server\.ts")
    }
    foreach ($p in $nodeProcs) {
        Write-Host "  [CLEANUP] Stopping lingering Node server (PID: $($p.ProcessId))..." -ForegroundColor Yellow
        cmd.exe /c "taskkill /F /T /PID $($p.ProcessId) 2>nul" | Out-Null
    }
} catch {
    # continue silently
}

Start-Sleep -Seconds 1

# 4. Verification
$chk3001 = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
$chk8000 = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

Write-Host ""
if ((-not $chk3001) -and (-not $chk8000)) {
    Write-Host "  [OK] Both Port 3001 and Port 8000 are completely freed." -ForegroundColor Green
    Write-Host "  [INFO] MySQL database service remains running and intact." -ForegroundColor Gray
} else {
    if ($chk3001) { Write-Host "  [WARN] Port 3001 is still in use." -ForegroundColor Yellow }
    if ($chk8000) { Write-Host "  [WARN] Port 8000 is still in use." -ForegroundColor Yellow }
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
exit 0
