$ErrorActionPreference = 'Stop'

$RepoBase = "https://raw.githubusercontent.com/Srinevasan22/weavemap/main"
$TargetDir = "weavemap"

Write-Host "Installing WeaveMap into .\$TargetDir..." -ForegroundColor Cyan

if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

$RuntimeFiles = @("PROTOCOL.md", "index.html", "app.js", "style.css", "generate_hud.mjs", "generate_hud.ps1")

foreach ($file in $RuntimeFiles) {
    Write-Host "  Downloading $file..."
    Invoke-RestMethod -Uri "$RepoBase/$file" -OutFile "$TargetDir\$file"
}

$StatePath = Join-Path $TargetDir "state.js"
if (-not (Test-Path $StatePath)) {
    Write-Host "  Initializing blank $StatePath..."
    Invoke-RestMethod -Uri "$RepoBase/state.template.js" -OutFile $StatePath
} else {
    Write-Host "  Existing $StatePath preserved." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "WeaveMap installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Tell your AI coding assistant:" -ForegroundColor Gray
Write-Host '  Read weavemap/PROTOCOL.md and use WeaveMap to manage this project as you work.' -ForegroundColor White
Write-Host ""
Write-Host "Open $TargetDir\index.html anytime to inspect or steer your project." -ForegroundColor Cyan
