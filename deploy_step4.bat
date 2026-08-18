@echo off
title NEXT ZERO - GitHub Deployment Tool (yixuan210)

:: Automatically detect and add Git installation path to environment variables
if exist "C:\Program Files\Git\cmd" (
    set "PATH=C:\Program Files\Git\cmd;C:\Program Files\Git\bin;%PATH%"
)
if exist "C:\Program Files (x86)\Git\cmd" (
    set "PATH=C:\Program Files (x86)\Git\cmd;C:\Program Files (x86)\Git\bin;%PATH%"
)
if exist "%LOCALAPPDATA%\Programs\Git\cmd" (
    set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%LOCALAPPDATA%\Programs\Git\bin;%PATH%"
)

echo ========================================================
echo   NEXT ZERO Project - Step 4: Push to GitHub
echo   User Account : yixuan210
echo   Remote Repo  : https://github.com/yixuan210/next-zero-campus.git
echo ========================================================
echo.

:: Verify Git executable existence
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git executable not found!
    echo Please make sure Git is installed: https://git-scm.com/
    echo.
    pause
    exit /b 1
)

:: Switch working directory to current script location
cd /d "%~dp0"

echo [1/5] Initializing local Git repository...
if not exist ".git" (
    git init
) else (
    echo  - Local .git repository already exists. Continuing...
)

echo.
echo [2/5] Adding all files to staging area...
git add .

echo.
echo [3/5] Creating commit...
git commit -m "feat: initial release of NEXT ZERO puzzle and admin portal"

echo.
echo [4/5] Setting default branch to main and linking remote origin...
git branch -M main

:: Check if remote origin already exists
git remote get-url origin >nul 2>nul
if %errorlevel% neq 0 (
    git remote add origin https://github.com/yixuan210/next-zero-campus.git
    echo  - Successfully added remote origin.
) else (
    git remote set-url origin https://github.com/yixuan210/next-zero-campus.git
    echo  - Remote origin exists. Updated target URL.
)

echo.
echo [5/5] Pushing source code to GitHub (main branch)...
echo (Note: If a browser window pops up, please sign in to authorize account yixuan210)
echo.
git push -u origin main

echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   [SUCCESS] Code pushed to GitHub successfully!
    echo.
    echo   Next step (Step 5):
    echo   Enable GitHub Pages in your repository settings:
    echo   https://github.com/yixuan210/next-zero-campus/settings/pages
    echo.
    echo   Live URLs:
    echo   Frontend: https://yixuan210.github.io/next-zero-campus/
    echo   Admin   : https://yixuan210.github.io/next-zero-campus/admin.html
    echo ========================================================
) else (
    echo ========================================================
    echo   [WARNING] Push not completed. Please verify:
    echo   1. The public repository 'next-zero-campus' exists on GitHub.
    echo   2. You have authorized account yixuan210 in the browser.
    echo ========================================================
)

echo.
pause
