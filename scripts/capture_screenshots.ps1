$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$root = (Get-Location).Path
$screenshotsDir = Join-Path $root "screenshots"

if (-not (Test-Path $screenshotsDir)) {
    New-Item -ItemType Directory -Path $screenshotsDir -Force | Out-Null
}

$routes = @(
    @{ Name = "01_overview_dashboard.png"; Url = "http://localhost:3001/#overview" },
    @{ Name = "02_work_order_command_center.png"; Url = "http://localhost:3001/#work-orders" },
    @{ Name = "03_asset_registry.png"; Url = "http://localhost:3001/#assets" },
    @{ Name = "04_technician_lifecycle_management.png"; Url = "http://localhost:3001/#technicians" },
    @{ Name = "05_digital_inspections.png"; Url = "http://localhost:3001/#inspections" },
    @{ Name = "06_maintenance_analytics.png"; Url = "http://localhost:3001/#analytics" },
    @{ Name = "07_administration.png"; Url = "http://localhost:3001/#administration" }
)

foreach ($item in $routes) {
    $outFile = Join-Path $screenshotsDir $item.Name
    Write-Host "Capturing $($item.Name) from $($item.Url)..."
    Start-Process -FilePath $chrome -ArgumentList "--headless=new", "--disable-gpu", "--virtual-time-budget=4000", "--window-size=1440,900", "--screenshot=$outFile", $item.Url -Wait
}

Write-Host "All screenshots captured successfully."
