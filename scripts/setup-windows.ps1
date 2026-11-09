# PocketCraft - Universal Windows Setup Script (Windows 7 / 8 / 10 / 11)
$ErrorActionPreference = "Continue"

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  ⛏️  PocketCraft: Universal Windows Server Installer" -ForegroundColor Green
Write-Host "  Compatible with Windows 7, 8, 10, 11 (64-bit)" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $PSScriptRoot
Set-Location $rootDir

# 1. Directories
$serverDir = Join-Path $rootDir "server"
$pluginsDir = Join-Path $serverDir "plugins"
$configDir = Join-Path $rootDir "config"

if (-not (Test-Path $pluginsDir)) { New-Item -ItemType Directory -Path $pluginsDir -Force | Out-Null }
if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }

# 2. Check / Auto-Install Java
Write-Host "`n[1/6] Checking Java Environment..." -ForegroundColor Yellow
$javaInstalled = $false
try {
    $javaVer = java -version 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -or $javaVer -match "Runtime Environment|version") {
        Write-Host "[✓] Java is installed: $($javaVer.Split("`n")[0].Trim())" -ForegroundColor Green
        $javaInstalled = $true
    }
} catch {}

if (-not $javaInstalled) {
    Write-Host "[!] Java is not detected on this system." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[+] Attempting automated installation of Eclipse Temurin Java 21 via winget..." -ForegroundColor Cyan
        Start-Process winget -ArgumentList "install -e --id EclipseAdoptium.Temurin.21.JRE --accept-package-agreements --accept-source-agreements --silent" -Wait
    } else {
        Write-Host "[!] Winget not available (Windows 7/8). Please download Java 21 from https://adoptium.net/" -ForegroundColor Red
    }
}

# 3. Check / Auto-Install Node.js
Write-Host "`n[2/6] Checking Node.js Environment..." -ForegroundColor Yellow
$nodeInstalled = $false
try {
    $nodeVer = node -v
    if ($nodeVer -match "v\d+") {
        Write-Host "[✓] Node.js is installed: $nodeVer" -ForegroundColor Green
        $nodeInstalled = $true
    }
} catch {}

if (-not $nodeInstalled) {
    Write-Host "[!] Node.js is not detected on this system." -ForegroundColor Yellow
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "[+] Attempting automated installation of Node.js LTS via winget..." -ForegroundColor Cyan
        Start-Process winget -ArgumentList "install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent" -Wait
    } else {
        Write-Host "[!] Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    }
}

# 4. Download Purpur Minecraft Server Engine
$serverJar = Join-Path $serverDir "server.jar"
Write-Host "`n[3/6] Downloading Purpur Server Engine (1.20.4)..." -ForegroundColor Yellow
if (-not (Test-Path $serverJar) -or (Get-Item $serverJar).Length -lt 1000000) {
    Write-Host "Downloading Purpur server.jar (~46 MB)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://api.purpurmc.org/v2/purpur/1.20.4/latest/download" -OutFile $serverJar -UseBasicParsing
    Write-Host "[✓] Purpur server.jar installed." -ForegroundColor Green
} else {
    Write-Host "[✓] server.jar already present." -ForegroundColor Green
}

# Auto-accept EULA & generate mobile-optimized server.properties
Set-Content -Path (Join-Path $serverDir "eula.txt") -Value "eula=true"
$serverProps = Join-Path $serverDir "server.properties"
if (-not (Test-Path $serverProps)) {
    @"
motd=\u00A7aPocketCraft Server \u00A77| \u00A7eHosted on Windows
server-port=25566
view-distance=8
simulation-distance=6
max-players=10
difficulty=normal
gamemode=survival
network-compression-threshold=256
online-mode=true
enable-query=false
sync-chunk-writes=false
"@ | Set-Content -Path $serverProps
}

# 5. Cross-play Plugins (GeyserMC + Floodgate)
Write-Host "`n[4/6] Installing Cross-Play Plugins (GeyserMC + Floodgate)..." -ForegroundColor Yellow
$geyserJar = Join-Path $pluginsDir "Geyser-Spigot.jar"
if (-not (Test-Path $geyserJar) -or (Get-Item $geyserJar).Length -lt 1000000) {
    Write-Host "Downloading GeyserMC (~52 MB)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/spigot" -OutFile $geyserJar -UseBasicParsing
    Write-Host "[✓] GeyserMC installed." -ForegroundColor Green
} else {
    Write-Host "[✓] GeyserMC already present." -ForegroundColor Green
}

$floodgateJar = Join-Path $pluginsDir "floodgate-spigot.jar"
if (-not (Test-Path $floodgateJar) -or (Get-Item $floodgateJar).Length -lt 100000) {
    Write-Host "Downloading Floodgate (~11 MB)..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/spigot" -OutFile $floodgateJar -UseBasicParsing
    Write-Host "[✓] Floodgate installed." -ForegroundColor Green
} else {
    Write-Host "[✓] Floodgate already present." -ForegroundColor Green
}

# 6. Playit.gg Tunnel & lazymc
Write-Host "`n[5/6] Downloading Playit.gg & lazymc binaries..." -ForegroundColor Yellow
$playitExe = Join-Path $rootDir "playit.exe"
if (-not (Test-Path $playitExe) -or (Get-Item $playitExe).Length -lt 1000000) {
    Write-Host "Downloading playit.exe..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/playit-cloud/playit-agent/releases/download/v1.2.0/playit-windows-x86_64.exe" -OutFile $playitExe -UseBasicParsing
    Write-Host "[✓] Playit agent installed." -ForegroundColor Green
} else {
    Write-Host "[✓] playit.exe already present." -ForegroundColor Green
}

$lazymcExe = Join-Path $rootDir "lazymc.exe"
if (-not (Test-Path $lazymcExe) -or (Get-Item $lazymcExe).Length -lt 500000) {
    Write-Host "Downloading lazymc.exe..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri "https://github.com/timvisee/lazymc/releases/download/v0.2.11/lazymc-v0.2.11-windows.exe" -OutFile $lazymcExe -UseBasicParsing
    Write-Host "[✓] lazymc proxy installed." -ForegroundColor Green
} else {
    Write-Host "[✓] lazymc.exe already present." -ForegroundColor Green
}

# 7. NPM dependencies
Write-Host "`n[6/6] Verifying Web Manager dependencies..." -ForegroundColor Yellow
if (Test-Path (Join-Path $rootDir "package.json")) {
    npm install --silent
}

Write-Host "`n================================================================" -ForegroundColor Green
Write-Host "  🎉 POCKETCRAFT SETUP COMPLETE!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host "To launch the server and web dashboard, simply run:" -ForegroundColor White
Write-Host "   .\start-windows.bat   or   node server.js" -ForegroundColor Yellow
