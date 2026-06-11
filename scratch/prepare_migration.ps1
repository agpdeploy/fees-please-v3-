# prepare_migration.ps1
# This script packages your project and Antigravity history for easy migration.

$ErrorActionPreference = "Stop"

# 1. Define Paths
$username = [System.Environment]::UserName
$desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath("Desktop"), "fees_please_migration_backup")
$projectDir = "c:\Users\$username\fees-please-v3"
$antigravityDir = "C:\Users\$username\.gemini\antigravity"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Preparing Migration Backup" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Backup Destination: $desktopPath" -ForegroundColor Yellow

# Create backup directory if it doesn't exist
if (-not (Test-Path $desktopPath)) {
    New-Item -ItemType Directory -Force -Path $desktopPath | Out-Null
}

# 2. Package Antigravity History
Write-Host "`n[1/2] Backing up Antigravity History..." -ForegroundColor Cyan
if (Test-Path $antigravityDir) {
    $antigravityZip = Join-Path $desktopPath "antigravity_history.zip"
    if (Test-Path $antigravityZip) { Remove-Item $antigravityZip -Force }

    # Create temporary structure for zipping brain and config only (avoiding large cache files)
    $tempBackupDir = Join-Path $desktopPath "temp_antigravity"
    if (Test-Path $tempBackupDir) { Remove-Item $tempBackupDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempBackupDir | Out-Null

    # Copy brain directory (contains conversation history, logs, artifacts)
    $brainSource = Join-Path $antigravityDir "brain"
    if (Test-Path $brainSource) {
        $brainDest = Join-Path $tempBackupDir "brain"
        Copy-Item -Path $brainSource -Destination $brainDest -Recurse -Force
        Write-Host " -> Copied history logs and artifacts." -ForegroundColor Green
    } else {
        Write-Host " -> Warning: Brain folder not found in $antigravityDir" -ForegroundColor Yellow
    }

    # Zip the temp folder
    Compress-Archive -Path "$tempBackupDir\*" -DestinationPath $antigravityZip -Force
    # Clean up temp folder
    Remove-Item $tempBackupDir -Recurse -Force
    Write-Host " -> Created $antigravityZip" -ForegroundColor Green
} else {
    Write-Host " -> Error: Antigravity directory not found at $antigravityDir" -ForegroundColor Red
}

# 3. Package Project Folder (fees-please-v3)
Write-Host "`n[2/2] Backing up Project Folder (excluding build artifacts)..." -ForegroundColor Cyan
if (Test-Path $projectDir) {
    $projectZip = Join-Path $desktopPath "fees_please_project.zip"
    if (Test-Path $projectZip) { Remove-Item $projectZip -Force }

    # Create temporary structure to copy project files excluding node_modules, .next, .vercel, etc.
    $tempProjDir = Join-Path $desktopPath "temp_project"
    if (Test-Path $tempProjDir) { Remove-Item $tempProjDir -Recurse -Force }
    New-Item -ItemType Directory -Path $tempProjDir | Out-Null

    # Perform copy excluding large build/module directories
    Get-ChildItem -Path $projectDir -Exclude "node_modules", ".next", ".vercel", "playwright-report", "test-results" | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $tempProjDir -Recurse -Force
    }
    Write-Host " -> Copied project files (excluding node_modules and build dirs)." -ForegroundColor Green
    Write-Host " -> Copied .env.local file successfully." -ForegroundColor Green

    # Zip the project
    Compress-Archive -Path "$tempProjDir\*" -DestinationPath $projectZip -Force
    # Clean up temp folder
    Remove-Item $tempProjDir -Recurse -Force
    Write-Host " -> Created $projectZip" -ForegroundColor Green
} else {
    Write-Host " -> Error: Project directory not found at $projectDir" -ForegroundColor Red
}

Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host "Backup Complete!" -ForegroundColor Green
Write-Host "Please transfer the directory below to your new PC:" -ForegroundColor White
Write-Host "$desktopPath" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Cyan
