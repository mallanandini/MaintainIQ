$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$root = (Get-Location).Path
$darkOut = Join-Path $root 'screenshots\08_dark_theme_overview.png'
$lightOut = Join-Path $root 'screenshots\09_light_theme_overview.png'

Write-Host "Capturing dark mode overview..."
Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--force-prefers-color-scheme=dark",
    "--virtual-time-budget=4000",
    "--window-size=1440,900",
    "--screenshot=$darkOut",
    "http://localhost:3001/#overview"
) -Wait

Write-Host "Capturing light mode overview..."
Start-Process -FilePath $chrome -ArgumentList @(
    "--headless=new",
    "--disable-gpu",
    "--force-prefers-color-scheme=light",
    "--virtual-time-budget=4000",
    "--window-size=1440,900",
    "--screenshot=$lightOut",
    "http://localhost:3001/#overview"
) -Wait

Copy-Item -Path $darkOut, $lightOut -Destination (Join-Path $root "TEST_EVIDENCE\screenshots") -Force
Write-Host "Theme screenshots successfully captured and copied to TEST_EVIDENCE\screenshots."
