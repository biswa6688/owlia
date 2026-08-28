#!/usr/bin/env pwsh
# OWLIA build + publish script
# Usage:  .\build.ps1 [-Configuration Release] [-SkipFrontend] [-SkipInstaller]

param(
    [string] $Configuration = "Release",
    [switch] $SkipFrontend,
    [switch] $SkipInstaller
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root     = $PSScriptRoot
$hostProj = Join-Path $root "src\Owlia.Host\Owlia.Host.csproj"
$webDir   = Join-Path $root "src\Owlia.Web"
$publishDir = Join-Path $root "src\Owlia.Host\publish"
$wwwroot  = Join-Path $root "src\Owlia.Host\wwwroot"
$setupDir = Join-Path $root "setup"
$issFile  = Join-Path $setupDir "owlia-setup.iss"

Write-Host "`n=== OWLIA Build Script ===" -ForegroundColor Cyan
Write-Host "Configuration : $Configuration"
Write-Host "Root          : $root"

# ── 1. Frontend ──────────────────────────────────────────────────────────────
if (-not $SkipFrontend) {
    Write-Host "`n--- Building React frontend ---" -ForegroundColor Yellow
    Push-Location $webDir
    try {
        & npm ci --silent
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "vite build failed" }

        Write-Host "Frontend built → $wwwroot" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# ── 2. Backend publish ────────────────────────────────────────────────────────
Write-Host "`n--- Publishing .NET backend ---" -ForegroundColor Yellow

if (Test-Path $publishDir) {
    Remove-Item $publishDir -Recurse -Force
}

& dotnet publish $hostProj `
    --configuration $Configuration `
    --runtime win-x64 `
    --self-contained `
    --output $publishDir `
    /p:PublishSingleFile=false `
    /p:PublishTrimmed=false

if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

Write-Host "Backend published → $publishDir" -ForegroundColor Green

# ── 3. Copy frontend into publish dir ────────────────────────────────────────
$publishWww = Join-Path $publishDir "wwwroot"
if (Test-Path $wwwroot) {
    Write-Host "`n--- Copying wwwroot into publish ---" -ForegroundColor Yellow
    if (Test-Path $publishWww) { Remove-Item $publishWww -Recurse -Force }
    Copy-Item $wwwroot $publishWww -Recurse
    Write-Host "wwwroot copied → $publishWww" -ForegroundColor Green
}

# ── 4. Copy models.json into publish dir ────────────────────────────────────
$srcManifest  = Join-Path $root "models\models.json"
$destModels   = Join-Path $publishDir "models"
New-Item -ItemType Directory -Force -Path $destModels | Out-Null
Copy-Item $srcManifest (Join-Path $destModels "models.json") -Force
Write-Host "models.json copied" -ForegroundColor Green

# ── 5. Ensure data/ and logs/ dirs exist ────────────────────────────────────
New-Item -ItemType Directory -Force -Path (Join-Path $publishDir "data")   | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publishDir "logs")   | Out-Null

# ── 6. InnoSetup ─────────────────────────────────────────────────────────────
if (-not $SkipInstaller) {
    Write-Host "`n--- Building InnoSetup installer ---" -ForegroundColor Yellow

    $iscc = Get-Command "iscc.exe" -ErrorAction SilentlyContinue
    if (-not $iscc) {
        # Common InnoSetup 6 installation path
        $iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
    } else {
        $iscc = $iscc.Source
    }

    if (-not (Test-Path $iscc)) {
        Write-Warning "ISCC.exe not found. Skipping installer. Install InnoSetup 6 from https://jrsoftware.org/isdl.php"
    } else {
        & $iscc $issFile
        if ($LASTEXITCODE -ne 0) { throw "InnoSetup build failed" }
        Write-Host "Installer built → $setupDir\Output\" -ForegroundColor Green
    }
}

Write-Host "`n=== Build complete ===" -ForegroundColor Cyan
Write-Host "Publish dir : $publishDir"
if (-not $SkipInstaller -and (Test-Path "$setupDir\Output")) {
    $installer = Get-ChildItem "$setupDir\Output\*.exe" | Select-Object -Last 1
    if ($installer) { Write-Host "Installer   : $($installer.FullName)" }
}
