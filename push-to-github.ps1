$ErrorActionPreference = "Stop"

if (-not (Test-Path ".git")) {
    git init -b main
}

$remotes = git remote
if ($remotes -notcontains "origin") {
    git remote add origin https://github.com/BlizzHacker/freebooks-open-source.git
} else {
    git remote set-url origin https://github.com/BlizzHacker/freebooks-open-source.git
}

Write-Host "Fetching origin/main history from GitHub..." -ForegroundColor Cyan
git fetch origin main
git reset --soft origin/main

Write-Host "Staging and committing upgraded FreeBooks Universal files..." -ForegroundColor Cyan
git add -A
git commit --no-verify -m "feat: add universal banking hub, email subscription scanner, tax center, credit health, and credit builder"

Write-Host "Pushing to origin/main..." -ForegroundColor Green
git push -u origin main
