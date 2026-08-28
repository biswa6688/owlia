#!/usr/bin/env pwsh
# OWLIA build + publish script
#
# Usage:
#   .\build.ps1                        # full release build + installer
#   .\build.ps1 -SkipFrontend         # skip npm/vite (wwwroot already built)
#   .\build.ps1 -SkipInstaller        # skip InnoSetup step
#   .\build.ps1 -Configuration Debug  # debug build (no installer)
#
# Output:
#   src\Owlia.Host\publish\   — framework-dependent app files (~30 MB)
#   setup\Output\             — owlia-setup-<version>.exe

param(
    [string] $Configuration = "Release",
    [switch] $SkipFrontend,
    [switch] $SkipInstaller
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root       = $PSScriptRoot
$hostProj   = Join-Path $root "src\Owlia.Host\Owlia.Host.csproj"
$webDir     = Join-Path $root "src\Owlia.Web"
$publishDir = Join-Path $root "src\Owlia.Host\publish"
$wwwroot    = Join-Path $root "src\Owlia.Host\wwwroot"
$setupDir   = Join-Path $root "setup"
$issFile    = Join-Path $setupDir "owlia-setup.iss"

Write-Host "`n=== OWLIA Build Script ===" -ForegroundColor Cyan
Write-Host "Configuration : $Configuration"
Write-Host "Root          : $root"

# ── 1. Frontend (React + Vite) ───────────────────────────────────────────────
if (-not $SkipFrontend) {
    Write-Host "`n--- Building React frontend ---" -ForegroundColor Yellow
    Push-Location $webDir
    try {
        & npm ci --silent
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "vite build failed" }

        $jsSize = (Get-ChildItem "$wwwroot\assets\*.js" | Measure-Object Length -Sum).Sum
        Write-Host "Frontend built → $wwwroot  ($([Math]::Round($jsSize/1KB)) KB JS)" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# ── 2. Backend — framework-dependent publish ─────────────────────────────────
Write-Host "`n--- Publishing .NET backend (framework-dependent, win-x64) ---" -ForegroundColor Yellow

if (Test-Path $publishDir) {
    Remove-Item $publishDir -Recurse -Force
}

#   --no-self-contained  : do NOT bundle the .NET runtime → much smaller output
#   --runtime win-x64    : still needed so Photino.Native.dll is copied correctly
#                          (matches <RuntimeIdentifier> in csproj, explicit here
#                           for clarity; dotnet will use csproj value anyway)
#   /p:PublishSingleFile=false   : keep DLLs separate (easier debugging + smaller)
#   /p:PublishTrimmed=false      : no trimming — ONNX Runtime needs reflection
& dotnet publish $hostProj `
    --configuration $Configuration `
    --runtime win-x64 `
    --no-self-contained `
    --output $publishDir `
    /p:PublishSingleFile=false `
    /p:PublishTrimmed=false

if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed" }

$pubSize = (Get-ChildItem $publishDir -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host "Backend published → $publishDir  ($([Math]::Round($pubSize/1MB, 1)) MB)" -ForegroundColor Green

# ── 3. Copy wwwroot into publish dir ─────────────────────────────────────────
$publishWww = Join-Path $publishDir "wwwroot"
if (Test-Path $wwwroot) {
    Write-Host "`n--- Copying wwwroot into publish ---" -ForegroundColor Yellow
    if (Test-Path $publishWww) { Remove-Item $publishWww -Recurse -Force }
    Copy-Item $wwwroot $publishWww -Recurse
    $wwwSize = (Get-ChildItem $publishWww -Recurse -File | Measure-Object Length -Sum).Sum
    Write-Host "wwwroot copied → $publishWww  ($([Math]::Round($wwwSize/1KB)) KB)" -ForegroundColor Green
}

# ── 4. Copy models.json into publish/models/ ─────────────────────────────────
$srcManifest = Join-Path $root "models\models.json"
$destModels  = Join-Path $publishDir "models"
New-Item -ItemType Directory -Force -Path $destModels | Out-Null
Copy-Item $srcManifest (Join-Path $destModels "models.json") -Force
Write-Host "models.json  → $destModels" -ForegroundColor Green

# ── 5. Ensure empty runtime dirs exist ───────────────────────────────────────
New-Item -ItemType Directory -Force -Path (Join-Path $publishDir "data")  | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publishDir "logs")  | Out-Null

# ── 6. Total publish size summary ────────────────────────────────────────────
$totalSize = (Get-ChildItem $publishDir -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host "`nTotal publish size : $([Math]::Round($totalSize/1MB, 1)) MB  (excl. models)" -ForegroundColor Cyan
Write-Host "(The installer will prompt to download .NET 10 + WebView2 if not present)"

# ── 7. InnoSetup installer ───────────────────────────────────────────────────
if (-not $SkipInstaller) {
    Write-Host "`n--- Building InnoSetup installer ---" -ForegroundColor Yellow

    # Locate ISCC.exe
    $iscc = $null
    $candidates = @(
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe"
    )
    $fromPath = Get-Command "iscc.exe" -ErrorAction SilentlyContinue
    if ($fromPath) { $iscc = $fromPath.Source }
    else {
        foreach ($c in $candidates) {
            if (Test-Path $c) { $iscc = $c; break }
        }
    }

    if (-not $iscc) {
        Write-Warning "ISCC.exe not found — skipping installer."
        Write-Warning "Install InnoSetup 6 from https://jrsoftware.org/isdl.php"
    } else {
        Write-Host "Using ISCC: $iscc"
        & $iscc $issFile
        if ($LASTEXITCODE -ne 0) { throw "InnoSetup build failed" }

        $installer = Get-ChildItem "$setupDir\Output\*.exe" | Sort-Object LastWriteTime | Select-Object -Last 1
        $instSize  = [Math]::Round($installer.Length / 1MB, 1)
        Write-Host "Installer built → $($installer.FullName)  ($instSize MB)" -ForegroundColor Green
    }
}

Write-Host "`n=== Build complete ===" -ForegroundColor Cyan
Write-Host "Publish : $publishDir"
if (-not $SkipInstaller -and (Test-Path "$setupDir\Output")) {
    $installer = Get-ChildItem "$setupDir\Output\*.exe" | Sort-Object LastWriteTime | Select-Object -Last 1
    if ($installer) { Write-Host "Setup   : $($installer.FullName)" }
}
