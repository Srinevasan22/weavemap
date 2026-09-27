param (
    [Parameter(Position=0)][string]$ProjectPath = ".",
    [Parameter(Position=1)][string]$ArtifactPath,
    [switch]$CheckOnly,
    [switch]$Serve,
    [int]$Port = 4173,
    [switch]$Help
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'WeaveMap requires Node.js 18 or newer. Install Node.js, then retry.'
}
$HudArguments = @((Join-Path $PSScriptRoot 'generate_hud.mjs'), '--project-path', $ProjectPath)
if ($ArtifactPath) { $HudArguments += @('--artifact-path', $ArtifactPath) }
if ($CheckOnly) { $HudArguments += '--check-only' }
if ($Serve) { $HudArguments += @('--serve', '--port', $Port) }
if ($Help) { $HudArguments += '--help' }
& node @HudArguments
exit $LASTEXITCODE
