# FACEIT Form Level - one-button build.
# Run (paste whole line into PowerShell):
#   powershell -ExecutionPolicy Bypass -File "C:\Users\angel\Downloads\Claude\build.ps1"
#
# Checks Node.js, installs deps once, builds dist\chromium and dist\firefox,
# then opens the dist folder in Explorer.

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "===== FACEIT Form Level - build =====" -ForegroundColor Cyan

# 1) Node.js present?
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host ""
    Write-Host "Node.js NOT found on this machine." -ForegroundColor Red
    Write-Host "Install it with one command in a NEW PowerShell window:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor White
    Write-Host ""
    Write-Host "Then CLOSE and reopen the terminal and run this script again." -ForegroundColor Yellow
    exit 1
}
Write-Host ("Node.js: " + (node -v)) -ForegroundColor Green

# 2) Dependencies (only if missing)
if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
    Write-Host "Installing dependencies (npm install)... one-time, ~1 min" -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed." -ForegroundColor Red; exit 1 }
}

# 3) Build
Write-Host "Building (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed." -ForegroundColor Red; exit 1 }

# 4) Result
$chromium = Join-Path $PSScriptRoot "dist\chromium"
$firefox  = Join-Path $PSScriptRoot "dist\firefox"
Write-Host ""
Write-Host "DONE!" -ForegroundColor Green
Write-Host ("  Chrome / Opera / Yandex  ->  " + $chromium) -ForegroundColor White
Write-Host ("  Firefox                  ->  " + $firefox)  -ForegroundColor White
Write-Host ""
Write-Host "Next: load that folder as an unpacked extension (see instructions)." -ForegroundColor Yellow

# Open dist folder in Explorer
if (Test-Path (Join-Path $PSScriptRoot "dist")) {
    Start-Process explorer.exe (Join-Path $PSScriptRoot "dist")
}
