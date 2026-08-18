# NEXT ZERO Project - Step 4 PowerShell Deployment Tool
# User Account : yixuan210
# Remote Repo  : https://github.com/yixuan210/next-zero-campus.git

# Auto-detect Git path
if (Test-Path "C:\Program Files\Git\cmd") {
    $env:Path = "C:\Program Files\Git\cmd;C:\Program Files\Git\bin;" + $env:Path
}

Write-Host "========================================================" -ForegroundColor Green
Write-Host "  NEXT ZERO Project - Step 4: Push to GitHub" -ForegroundColor Green
Write-Host "  User Account : yixuan210" -ForegroundColor Cyan
Write-Host "  Remote Repo  : https://github.com/yixuan210/next-zero-campus.git" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

# Set current script directory
Set-Location -Path $PSScriptRoot

Write-Host "[1/5] Initializing local Git repository..." -ForegroundColor Yellow
if (!(Test-Path ".git")) {
    git init
} else {
    Write-Host " - Local .git repository already exists. Continuing..." -ForegroundColor Gray
}

Write-Host "`n[2/5] Adding all files to staging area..." -ForegroundColor Yellow
git add .

Write-Host "`n[3/5] Creating commit..." -ForegroundColor Yellow
git commit -m "feat: initial release of NEXT ZERO puzzle and admin portal"

Write-Host "`n[4/5] Setting default branch to main and linking remote origin..." -ForegroundColor Yellow
git branch -M main

$remoteUrl = git remote get-url origin 2>$null
if (!$remoteUrl) {
    git remote add origin https://github.com/yixuan210/next-zero-campus.git
    Write-Host " - Successfully added remote origin." -ForegroundColor Gray
} else {
    git remote set-url origin https://github.com/yixuan210/next-zero-campus.git
    Write-Host " - Remote origin exists. Target URL updated." -ForegroundColor Gray
}

Write-Host "`n[5/5] Pushing source code to GitHub (main branch)..." -ForegroundColor Yellow
Write-Host "(Note: If a browser window pops up, please sign in to authorize account yixuan210)`n" -ForegroundColor Cyan

git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  [SUCCESS] Code pushed to GitHub successfully!" -ForegroundColor Green
    Write-Host "  Next Step: Enable GitHub Pages in your repository settings:" -ForegroundColor White
    Write-Host "  https://github.com/yixuan210/next-zero-campus/settings/pages" -ForegroundColor Cyan
    Write-Host "`n  Live URLs:" -ForegroundColor White
    Write-Host "  Frontend: https://yixuan210.github.io/next-zero-campus/" -ForegroundColor Yellow
    Write-Host "  Admin   : https://yixuan210.github.io/next-zero-campus/admin.html" -ForegroundColor Yellow
    Write-Host "========================================================" -ForegroundColor Green
} else {
    Write-Host "`n========================================================" -ForegroundColor Red
    Write-Host "  [WARNING] Push not completed. Please verify:" -ForegroundColor Yellow
    Write-Host "  1. The public repository 'next-zero-campus' exists on GitHub." -ForegroundColor White
    Write-Host "  2. You have authorized account yixuan210 in the browser." -ForegroundColor White
    Write-Host "========================================================" -ForegroundColor Red
}

Write-Host "`nPress any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
