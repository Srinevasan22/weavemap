param (
    [Parameter(Position=0)]
    [string]$ProjectPath = ".",

    [Parameter(Position=1)]
    [string]$ArtifactPath = $null,

    [switch]$CheckOnly,

    [switch]$Help
)

if ($Help) {
    Write-Host "WeaveMap Cross-Platform HUD Generator & Validator (PowerShell)" -ForegroundColor Cyan
    Write-Host "`nUsage:"
    Write-Host "  .\generate_hud.ps1 [-ProjectPath <dir>] [-ArtifactPath <file>] [-CheckOnly]"
    Write-Host "`nOptions:"
    Write-Host "  -ProjectPath <dir>   Path to project root or weavemap directory (default: .)"
    Write-Host "  -ArtifactPath <file> Destination HTML path for compiled HUD"
    Write-Host "  -CheckOnly           Validate state.js schema and DAG without generating HTML"
    Write-Host "  -Help                Show this help message"
    exit 0
}

$weaveDir = Join-Path $ProjectPath "weavemap"
if (-not (Test-Path (Join-Path $weaveDir "index.html"))) {
    $weaveDir = $ProjectPath
}
$indexPath = Join-Path $weaveDir "index.html"
$stylePath = Join-Path $weaveDir "style.css"
$statePath = Join-Path $weaveDir "state.js"
$appPath = Join-Path $weaveDir "app.js"

if (-not (Test-Path $indexPath) -or -not (Test-Path $statePath)) {
    Write-Error "WeaveMap files not found in $ProjectPath or $weaveDir"
    exit 1
}

$index = Get-Content -LiteralPath $indexPath -Raw -Encoding utf8
$style = Get-Content -LiteralPath $stylePath -Raw -Encoding utf8
$state = Get-Content -LiteralPath $statePath -Raw -Encoding utf8
$app = Get-Content -LiteralPath $appPath -Raw -Encoding utf8

# Parse and validate state.js
$stateJsonMatch = [regex]::Match($state, '(?s)window\.WEAVEMAP\s*=\s*(.+?);?\s*$')
if (-not $stateJsonMatch.Success) {
    Write-Error "Invalid state.js: could not find window.WEAVEMAP payload."
    exit 1
}

$stateObj = $null
try {
    $stateObj = $stateJsonMatch.Groups[1].Value | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse state.js JSON: $_"
    exit 1
}

$errors = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

if (-not $stateObj.tasks) {
    $errors.Add("Missing required 'tasks' array in state.js")
}

$tasks = @($stateObj.tasks)
$validStatuses = [System.Collections.Generic.HashSet[string]]::new([string[]]@('todo', 'active', 'blocked', 'done', 'skipped'))
$seenIds = [System.Collections.Generic.HashSet[string]]::new()
$taskById = @{}

foreach ($t in $tasks) {
    if (-not $t.id) {
        $errors.Add("Task missing required 'id'")
        continue
    }
    if ($seenIds.Contains($t.id)) {
        $errors.Add("Duplicate task ID found: '$($t.id)'")
    }
    $seenIds.Add($t.id) | Out-Null
    $taskById[$t.id] = $t

    if (-not $t.title) { $errors.Add("Task '$($t.id)' missing required 'title'") }
    if (-not $t.status) {
        $errors.Add("Task '$($t.id)' missing 'status'")
    } elseif (-not $validStatuses.Contains($t.status)) {
        $errors.Add("Task '$($t.id)' has invalid status '$($t.status)'. Allowed: todo, active, blocked, done, skipped")
    }
}

foreach ($t in $tasks) {
    if ($t.dependsOn) {
        foreach ($depId in @($t.dependsOn)) {
            if (-not $taskById.ContainsKey($depId)) {
                $errors.Add("Task '$($t.id)' depends on non-existent task '$depId'")
            }
        }
    }
}

# Cycle detection
$visited = [System.Collections.Generic.HashSet[string]]::new()
$recStack = [System.Collections.Generic.HashSet[string]]::new()
$pathStack = [System.Collections.Generic.List[string]]::new()

function Test-Cycle($id) {
    $visited.Add($id) | Out-Null
    $recStack.Add($id) | Out-Null
    $pathStack.Add($id)

    $t = $taskById[$id]
    if ($t -and $t.dependsOn) {
        foreach ($depId in @($t.dependsOn)) {
            if (-not $taskById.ContainsKey($depId)) { continue }
            if (-not $visited.Contains($depId)) {
                if (Test-Cycle $depId) { return $true }
            } elseif ($recStack.Contains($depId)) {
                $cycleStart = $pathStack.IndexOf($depId)
                $chain = ($pathStack.GetRange($cycleStart, $pathStack.Count - $cycleStart) + $depId) -join " -> "
                $errors.Add("Circular dependency detected: $chain")
                return $true
            }
        }
    }

    $recStack.Remove($id) | Out-Null
    $pathStack.RemoveAt($pathStack.Count - 1)
    return $false
}

foreach ($id in $taskById.Keys) {
    if (-not $visited.Contains($id)) {
        if (Test-Cycle $id) { break }
    }
}

foreach ($w in $warnings) {
    Write-Warning "[WARN] $w"
}

if ($errors.Count -gt 0) {
    Write-Host "`nSchema Validation Failed ($($errors.Count) errors):" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "[ERR]  $err" -ForegroundColor Red
    }
    exit 1
}

$doneCount = ($tasks | Where-Object { $_.status -eq 'done' -or $_.status -eq 'completed' }).Count
Write-Host "[OK] WeaveMap state valid: $($tasks.Count) tasks ($doneCount completed, DAG acyclic)" -ForegroundColor Green

if ($CheckOnly) {
    Write-Host "Validation check complete (-CheckOnly passed)." -ForegroundColor Cyan
    exit 0
}

$hudCss = @'
/* =========================================================================
   Antigravity Side-Pane HUD (Refined Native WeaveMap Palette)
   ========================================================================= */

body.hud-mode-active {
  background: var(--bg) !important;
  color: var(--text) !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* Mode-based display for shell vs sidebar view */
body.hud-mode-active:not(.hud-full-canvas-mode) .shell {
  display: none !important;
}
body.hud-mode-active:not(.hud-full-canvas-mode) #hud-sidebar-view {
  display: block !important;
}
body.hud-full-canvas-mode #hud-sidebar-view {
  display: none !important;
}
body.hud-full-canvas-mode .shell {
  display: block !important;
}

/* Dialog Modals in HUD Mode */
dialog:not([open]) {
  display: none !important;
}
dialog[open] {
  display: block !important;
}
dialog {
  position: fixed !important;
  inset: 0 !important;
  margin: auto !important;
  max-width: 680px !important;
  width: min(720px, calc(100vw - 32px)) !important;
  max-height: 85vh !important;
  overflow-y: auto !important;
  background: var(--panel, #ffffff) !important;
  color: var(--text, #171717) !important;
  border: 1px solid var(--line, #deded8) !important;
  border-radius: 14px !important;
  box-shadow: 0 24px 72px rgba(16, 24, 40, 0.25) !important;
  padding: 24px !important;
  z-index: 100000 !important;
}
dialog::backdrop {
  background: rgba(15, 23, 42, 0.38) !important;
  backdrop-filter: blur(3px) !important;
}
.dialog-close {
  position: absolute !important;
  top: 14px !important;
  right: 16px !important;
  border: none !important;
  background: var(--soft, #f4f4f0) !important;
  width: 32px !important;
  height: 32px !important;
  border-radius: 8px !important;
  font-size: 20px !important;
  line-height: 1 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer !important;
  color: var(--muted, #666660) !important;
  transition: all 0.15s ease !important;
}
.dialog-close:hover {
  background: #e2e8f0 !important;
  color: #0f172a !important;
}

/* Sticky Mode Switcher Header */
.hud-top-switch-bar {
  position: sticky;
  top: 0;
  z-index: 9999;
  background: rgba(247, 247, 245, 0.96);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.hud-brand-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.hud-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  flex-shrink: 0;
}
.hud-brand-title {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  flex-shrink: 0;
}
.hud-phase-chip {
  font-size: 10.5px;
  background: var(--panel);
  color: var(--muted);
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.hud-switch-btns {
  display: flex;
  background: var(--soft);
  padding: 2px;
  border-radius: 7px;
  border: 1px solid var(--line);
  flex-shrink: 0;
}
.hud-switch-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 9px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
}
.hud-switch-btn.active {
  background: var(--panel);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}
.hud-switch-btn svg {
  width: 12px;
  height: 12px;
}

/* Container in HUD mode */
#hud-sidebar-view {
  padding: 12px 14px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 660px;
  margin: 0 auto;
}

/* Metrics Banner */
.hud-metrics-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}
.hud-metrics-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 7px;
}
.hud-project-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -0.01em;
}
.hud-progress-pct {
  font-size: 11.5px;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #059669;
}
.hud-progress-bar-bg {
  height: 5px;
  background: var(--soft);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 10px;
}
.hud-progress-fill {
  height: 100%;
  background: #10b981;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.hud-stat-chips {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.hud-stat-chip {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 5px;
  text-align: center;
  position: relative;
  cursor: help;
}
.hud-stat-chip::before {
  content: "";
  position: absolute;
  top: calc(100% + 2px);
  left: 50%;
  transform: translateX(-50%);
  border-width: 0 5px 5px 5px;
  border-style: solid;
  border-color: transparent transparent #171717 transparent;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 10001;
}
.hud-stat-chip::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 7px);
  left: 50%;
  transform: translateX(-50%) translateY(-3px);
  background: #171717;
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1.4;
  padding: 6px 10px;
  border-radius: 6px;
  width: max-content;
  max-width: 220px;
  text-align: center;
  box-shadow: 0 4px 14px rgba(0,0,0,0.2);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 10000;
  white-space: normal;
}
.hud-stat-chip:hover::before {
  opacity: 1;
}
.hud-stat-chip:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.hud-stat-chip.human { background: var(--approval); border-color: #ddd6fe; }
.hud-stat-chip.human .hud-stat-val { color: #6d28d9; }
.hud-stat-chip.human::after { left: 0; transform: translateY(-3px); }
.hud-stat-chip.human:hover::after { transform: translateY(0); }
.hud-stat-chip.human::before { left: 20px; }

.hud-stat-chip.ready { background: var(--ready); border-color: #bbf7d0; }
.hud-stat-chip.ready .hud-stat-val { color: #047857; }

.hud-stat-chip.waiting { background: var(--waiting); border-color: #fde68a; }
.hud-stat-chip.waiting .hud-stat-val { color: #b45309; }

.hud-stat-chip.blocked { background: var(--blocked); border-color: #fecaca; }
.hud-stat-chip.blocked .hud-stat-val { color: #b91c1c; }

.hud-stat-chip.done { background: #f8fafc; border-color: #94a3b8; }
.hud-stat-chip.done .hud-stat-val { color: #334155; }
.hud-stat-chip.done::after { left: auto; right: 0; transform: translateY(-3px); }
.hud-stat-chip.done:hover::after { transform: translateY(0); }
.hud-stat-chip.done::before { left: auto; right: 20px; }

.hud-stat-val {
  display: block;
  font-size: 14px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.2;
}
.hud-stat-lbl {
  font-size: 8.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
  margin-top: 2px;
}

/* Section Header */
.hud-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0 2px;
  user-select: none;
}
.hud-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.hud-section-title svg {
  width: 13px;
  height: 13px;
}
.hud-section-count {
  background: var(--soft);
  color: var(--muted);
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 999px;
  font-weight: 700;
  border: 1px solid var(--line);
}

/* Category Container & Scrollable Drawer */
.hud-category-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hud-category-scroll {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hud-category-scroll.scrollable {
  max-height: 440px;
  overflow-y: auto;
  padding-right: 3px;
}
.hud-category-scroll::-webkit-scrollbar {
  width: 5px;
}
.hud-category-scroll::-webkit-scrollbar-track {
  background: var(--soft);
  border-radius: 4px;
}
.hud-category-scroll::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 4px;
}
.hud-category-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}

/* Load More / Expand Toggle */
.hud-load-more-btn {
  background: var(--panel);
  border: 1px dashed var(--line);
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  transition: all 0.15s ease;
  width: 100%;
}
.hud-load-more-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: #f8fafc;
}
.hud-load-more-btn svg {
  width: 11px;
  height: 11px;
  transition: transform 0.2s ease;
}

/* Task Cards */
.hud-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 11px 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}
.hud-card:hover {
  border-color: #aaa9a3;
  box-shadow: 0 2px 5px rgba(0,0,0,0.04);
}
.hud-card-ready { border-left: 3.5px solid #10b981; }
.hud-card-waiting { border-left: 3.5px solid #f59e0b; }
.hud-card-human { border-left: 3.5px solid #8b5cf6; }
.hud-card-blocked { border-left: 3.5px solid #ef4444; }
.hud-card-done { border-left: 3.5px solid #94a3b8; background: #fafaf9; }

.hud-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}
.hud-card-id-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.hud-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  font-size: 11.5px;
  color: var(--text);
}
.hud-id.done { text-decoration: line-through; color: var(--muted); }

.hud-pbadge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  text-transform: uppercase;
  border: 1px solid var(--line);
  background: var(--soft);
  color: var(--text);
  line-height: 1.2;
}
.hud-pbadge.p1 { background: #fee2e2; color: #b91c1c; border-color: #fca5a5; }
.hud-pbadge.p2 { background: #fef3c7; color: #b45309; border-color: #fde68a; }
.hud-pbadge.p3 { background: var(--soft); color: var(--muted); border-color: var(--line); }

.hud-ws-pill {
  font-size: 9px;
  background: var(--soft);
  color: var(--muted);
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
  line-height: 1.2;
}
.hud-time-pill {
  font-size: 9.5px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  font-weight: 500;
  background: var(--soft);
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid var(--line);
  line-height: 1.2;
}
.hud-time-pill svg {
  stroke: var(--muted);
  flex-shrink: 0;
}

.hud-card-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  line-height: 1.35;
}
.hud-card-title.done { color: var(--muted); text-decoration: line-through; }

.hud-chevron-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  margin-top: 1px;
}
.hud-card.expanded .hud-chevron-btn {
  transform: rotate(180deg);
}

.hud-card-details {
  display: none;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
  font-size: 11px;
}
.hud-card.expanded .hud-card-details {
  display: block;
}

.hud-desc {
  color: var(--text);
  line-height: 1.45;
  margin-bottom: 7px;
}

.hud-cmd-pill {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
  color: #0f172a;
  cursor: pointer;
  margin: 6px 0;
  user-select: all;
  transition: border-color 0.15s, background 0.15s;
}
.hud-cmd-pill:hover {
  border-color: #2563eb;
  background: #e2e8f0;
}
.hud-cmd-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hud-cmd-left svg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  color: #2563eb;
}
.hud-copy-hint {
  font-size: 8.5px;
  color: #64748b;
  font-family: sans-serif;
  text-transform: uppercase;
  font-weight: 700;
  flex-shrink: 0;
}

.hud-acceptance-box {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 6px 9px;
  margin-top: 6px;
}
.hud-acceptance-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 3px;
}
.hud-acceptance-list {
  margin: 0;
  padding-left: 15px;
  color: var(--muted);
  font-size: 10.5px;
  line-height: 1.4;
}

.hud-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 10px;
  color: var(--muted);
}
.hud-meta-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hud-meta-left svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
}

/* The Weave Canvas Wrapper (Bottom Section of HUD) */
#hud-canvas-section {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#hud-canvas-slot .weave-panel {
  background: var(--panel) !important;
  border: 1px solid var(--line) !important;
  border-radius: 10px !important;
  padding: 14px !important;
  margin: 0 !important;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
}
#hud-canvas-slot .weave-header {
  margin-bottom: 12px !important;
}


/* Toast Notice */
#hud-toast {
  position: fixed;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%) translateY(40px);
  background: #171717;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
  z-index: 10000;
}
#hud-toast.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.hud-view-hidden {
  display: none !important;
}

/* Fullscreen Mode Styles in HUD */
.hud-mini-fs-btn {
  background: var(--soft);
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text);
  padding: 2px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.hud-mini-fs-btn:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
}
.hud-mini-fs-btn svg {
  width: 11px;
  height: 11px;
}
.icon-enter-fs.hidden,
.icon-exit-fs.hidden {
  display: none !important;
}
body.hud-mode-active.is-fullscreen .hud-top-switch-bar {
  position: sticky;
  top: 0;
  z-index: 1000;
}
body.hud-mode-active.is-fullscreen .weave-panel {
  min-height: calc(100vh - 60px);
}
body.hud-mode-active.is-fullscreen #weave-viewport {
  min-height: calc(100vh - 180px);
}

/* Responsive mobile layout (< 600px) */
@media (max-width: 600px) {
  .hud-top-switch-bar {
    padding: 6px 10px;
    gap: 6px;
  }
  .hud-brand-pill {
    gap: 5px;
    min-width: 0;
    flex-shrink: 1;
  }
  .hud-brand-title {
    font-size: 10.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hud-phase-chip {
    display: none;
  }
  .hud-switch-btns {
    padding: 2px;
    gap: 2px;
    flex-shrink: 0;
  }
  .hud-switch-btn {
    font-size: 10.5px;
    padding: 4px 6px;
    gap: 3px;
  }
  .hud-switch-btn .hud-fs-label {
    display: none;
  }
  .hud-switch-btn svg {
    width: 12px;
    height: 12px;
  }
  #hud-sidebar-view {
    padding: 8px 10px 24px;
    gap: 10px;
    max-width: 100%;
  }
  .hud-metrics-card {
    padding: 10px 12px;
  }
  .hud-stat-chips {
    gap: 4px;
  }
  .hud-stat-chip {
    padding: 4px 2px;
    min-width: 0;
  }
  .hud-stat-val {
    font-size: 13px;
  }
  .hud-stat-lbl {
    font-size: 8px;
  }
  .hud-card {
    padding: 8px 10px;
  }
  .hud-card-id-row {
    flex-wrap: wrap;
    gap: 4px;
  }
  .hud-card-title {
    font-size: 12px;
  }
  .hud-cmd-pill {
    padding: 5px 8px;
    font-size: 10px;
  }
  .hud-acceptance-box {
    padding: 7px 9px;
  }
  .hud-acceptance-list {
    padding-left: 14px;
    font-size: 10px;
  }
  .hud-meta-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .weave-canvas-wrapper {
    touch-action: pan-x pan-y;
    -webkit-overflow-scrolling: touch;
  }
}

@media (max-width: 380px) {
  .hud-top-switch-bar {
    padding: 5px 6px;
    gap: 4px;
  }
  .hud-brand-title {
    display: none;
  }
  .hud-switch-btn {
    padding: 3px 5px;
    font-size: 9.5px;
  }
}
'@

$hudHtmlBar = @'
<div class="hud-top-switch-bar">
  <div class="hud-brand-pill">
    <div class="hud-pulse-dot"></div>
    <span class="hud-brand-title">WeaveMap HUD</span>
    <span class="hud-phase-chip" id="hud-project-chip">Live</span>
  </div>
  <div class="hud-switch-btns">
    <button id="btn-hud-cockpit" class="hud-switch-btn active" onclick="setHudMode('cockpit')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      Sidebar HUD
    </button>
    <button id="btn-hud-canvas" class="hud-switch-btn" onclick="setHudMode('canvas')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><circle cx="5" cy="18" r="2.5"/><path d="M5 8.5v7"/><path d="M19 8.5v7"/><path d="M7.5 6h9"/><path d="M7.5 18h9"/><path d="M7 7.5l10 9"/></svg>
      Full Canvas
    </button>
    <button id="btn-hud-fullscreen" class="hud-switch-btn" onclick="toggleHudFullscreen()" title="Toggle PC Fullscreen (F11)">
      <svg class="icon-enter-fs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      <svg class="icon-exit-fs hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
      <span class="hud-fs-label">Full Screen</span>
    </button>
  </div>
</div>
<div id="hud-toast">Command copied!</div>
<div id="hud-sidebar-view"></div>
'@

$hudScript = @'
<script>
  const categoryExpanded = {
    human: false,
    ready: false,
    waiting: false,
    blocked: false,
    done: false
  };

  function toggleCategory(catKey) {
    categoryExpanded[catKey] = !categoryExpanded[catKey];
    renderSidebarHud();
  }

  let cachedWeavePanel = null;

  function getWeavePanel() {
    if (!cachedWeavePanel || !cachedWeavePanel.isConnected) {
      cachedWeavePanel = document.querySelector('.weave-panel') || cachedWeavePanel;
    }
    return cachedWeavePanel;
  }

  function setHudMode(mode) {
    const cockpitBtn = document.getElementById('btn-hud-cockpit');
    const canvasBtn = document.getElementById('btn-hud-canvas');
    const panel = getWeavePanel();
    const slot = document.getElementById('hud-canvas-slot');
    const home = document.getElementById('weave-panel-home') || document.querySelector('.shell') || document.body;

    if (mode === 'cockpit') {
      cockpitBtn?.classList.add('active');
      canvasBtn?.classList.remove('active');
      document.body.classList.remove('hud-full-canvas-mode');
      renderSidebarHud();
    } else {
      canvasBtn?.classList.add('active');
      cockpitBtn?.classList.remove('active');
      document.body.classList.add('hud-full-canvas-mode');
      if (home && panel && !home.contains(panel)) {
        home.appendChild(panel);
      }
      if (typeof window.refreshDerivedUI === 'function') {
        window.refreshDerivedUI();
      }
    }
    requestAnimationFrame(() => {
      if (typeof window.renderTheWeave === 'function') window.renderTheWeave();
    });
  }

  function toggleHudFullscreen() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    if (!isFs) {
      const target = document.documentElement;
      const req = target.requestFullscreen || target.webkitRequestFullscreen || target.msRequestFullscreen;
      if (req) {
        req.call(target).then(() => {
          setHudMode('canvas');
        }).catch((err) => {
          console.warn('Could not enter fullscreen:', err);
          setHudMode('canvas');
        });
      } else {
        setHudMode('canvas');
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch(() => {});
      }
    }
  }

  function onHudFullscreenChange() {
    const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    document.body.classList.toggle('is-fullscreen', isFs);
    const fsBtn = document.getElementById('btn-hud-fullscreen');
    if (fsBtn) {
      fsBtn.classList.toggle('active', isFs);
      const enterIcon = fsBtn.querySelector('.icon-enter-fs');
      const exitIcon = fsBtn.querySelector('.icon-exit-fs');
      const label = fsBtn.querySelector('.hud-fs-label');
      if (enterIcon && exitIcon) {
        enterIcon.classList.toggle('hidden', isFs);
        exitIcon.classList.toggle('hidden', !isFs);
      }
      if (label) {
        label.textContent = isFs ? 'Exit Full Screen' : 'Full Screen';
      }
      fsBtn.title = isFs ? 'Exit full screen (Esc)' : 'Toggle PC Fullscreen (F11)';
    }
    const miniBtns = document.querySelectorAll('.hud-mini-fs-btn span');
    miniBtns.forEach((s) => { s.textContent = isFs ? 'Exit Full' : 'Full Screen'; });

    if (isFs) {
      setHudMode('canvas');
    }
    requestAnimationFrame(() => {
      if (typeof window.renderTheWeave === 'function') window.renderTheWeave();
    });
  }

  document.addEventListener('fullscreenchange', onHudFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onHudFullscreenChange);

  function showHudToast(text) {
    const toast = document.getElementById('hud-toast');
    if (toast) {
      toast.textContent = text;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }
  }

  function copyCmd(cmdText, e) {
    if (e) e.stopPropagation();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cmdText).then(() => {
        showHudToast('Copied: ' + cmdText);
      }).catch(() => {
        fallbackCopyCmd(cmdText);
      });
    } else {
      fallbackCopyCmd(cmdText);
    }
  }

  function fallbackCopyCmd(cmdText) {
    const ta = document.createElement('textarea');
    ta.value = cmdText;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand('copy')) {
        showHudToast('Copied: ' + cmdText);
      } else {
        showHudToast('Copy blocked: ' + cmdText);
      }
    } catch {
      showHudToast('Copy blocked: ' + cmdText);
    } finally {
      ta.remove();
    }
  }

  function toggleCard(cardEl) {
    cardEl.classList.toggle('expanded');
  }

  function renderCategoryList(list, catKey, statusGroup) {
    if (!list.length) {
      if (catKey === 'human') {
        return '<div style="color:var(--muted); font-size:11px; font-style:italic; padding: 8px 12px; background:var(--panel); border:1px dashed var(--line); border-radius:7px;">No pending approval gates. AI is proceeding autonomously.</div>';
      }
      return '<div style="color:var(--muted); font-size:11px; font-style:italic; padding: 4px 0;">No tasks in this category.</div>';
    }

    const isExpanded = !!categoryExpanded[catKey];
    const visibleList = isExpanded ? list : list.slice(0, 3);
    const remaining = list.length - 3;

    return `
      <div class="hud-category-wrap">
        <div class="hud-category-scroll ${isExpanded && list.length > 3 ? 'scrollable' : ''}">
          ${visibleList.map(t => renderHudCard(t, statusGroup)).join('')}
        </div>
        ${list.length > 3 ? `
          <button type="button" class="hud-load-more-btn" onclick="toggleCategory('${catKey}')">
            <span>${isExpanded ? 'Collapse to top 3' : 'View all ' + list.length + ' tasks (+' + remaining + ' more)'}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform: ${isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'};">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
        ` : `
          <div style="font-size:10px; color:var(--muted); text-align:center; padding: 2px 0;">Showing all ${list.length} tasks</div>
        `}
      </div>
    `;
  }

  function mountCanvasSection() {
    const slot = document.getElementById('hud-canvas-slot');
    const home = document.getElementById('weave-panel-home') || document.querySelector('.shell') || document.body;
    const panel = getWeavePanel();
    if (!panel) return;

    if (document.body.classList.contains('hud-full-canvas-mode')) {
      if (home && !home.contains(panel)) {
        home.appendChild(panel);
      }
    } else {
      if (slot && !slot.contains(panel)) {
        slot.appendChild(panel);
      }
    }
    // Guarantee dialog modals are mounted directly to document.body outside hidden .shell
    ['task-dialog', 'update-dialog'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement !== document.body) {
        document.body.appendChild(el);
      }
    });
  }

  function renderSidebarHud() {
    const data = window.WEAVEMAP || {};
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const resolved = new Set(['done', 'skipped']);
    const byId = new Map(tasks.map(t => [t.id, t]));

    const deps = (t) => Array.isArray(t.dependsOn) ? t.dependsOn : [];
    const isUnmet = (t) => deps(t).some(id => !resolved.has(byId.get(id)?.status));

    const ready = [];
    const waiting = [];
    const done = [];
    const human = [];
    const blocked = [];

    tasks.forEach(t => {
      if (resolved.has(t.status)) {
        done.push(t);
      } else if (t.status === 'blocked') {
        blocked.push(t);
      } else if (t.humanApproval?.required && t.humanApproval?.status === 'pending') {
        human.push(t);
      } else if (!isUnmet(t)) {
        ready.push(t);
      } else {
        waiting.push(t);
      }
    });
 
    // Sort completed tasks in order of completed time: Most recent first!
    const taskIndexMap = new Map(tasks.map((t, idx) => [t.id, idx]));
    const depthMap = new Map();
    const computeDepth = (id, visited = new Set()) => {
      if (depthMap.has(id)) return depthMap.get(id);
      if (visited.has(id)) return 0;
      visited.add(id);
      const t = byId.get(id);
      if (!t || !Array.isArray(t.dependsOn) || t.dependsOn.length === 0) {
        depthMap.set(id, 0);
        return 0;
      }
      let maxD = 0;
      for (const parentId of t.dependsOn) {
        maxD = Math.max(maxD, 1 + computeDepth(parentId, new Set(visited)));
      }
      depthMap.set(id, maxD);
      return maxD;
    };
    tasks.forEach(t => computeDepth(t.id));

    const minKnownTime = done.reduce((min, t) => {
      const raw = t.completedAt || t.completion?.at || t.completion?.time || t.completedTime;
      if (raw) {
        const p = Date.parse(raw);
        if (!isNaN(p) && p < min) return p;
      }
      return min;
    }, Date.now());

    done.sort((a, b) => {
      const timeOf = (t) => {
        const raw = t.completedAt || t.completion?.at || t.completion?.time || t.completedTime;
        if (raw) {
          const parsed = Date.parse(raw);
          if (!isNaN(parsed)) return parsed;
        }
        // Fallback: tasks without explicit timestamp rank below timestamped tasks, ordered by depth and index
        const depth = depthMap.get(t.id) || 0;
        const idx = taskIndexMap.get(t.id) ?? 0;
        return (minKnownTime - 86400000) + (depth * 1000) + idx;
      };
      return timeOf(b) - timeOf(a); // Descending (most recent first)
    });

    const total = tasks.length || 1;
    const donePct = Math.round((done.length / total) * 100);

    const container = document.getElementById('hud-sidebar-view');
    if (!container) return;

    const projectName = data.project?.name || 'Project';
    const projectPhase = data.project?.phase || 'Active';
    document.getElementById('hud-project-chip').textContent = projectPhase;

    let html = `
      <div class="hud-metrics-card">
        <div class="hud-metrics-top">
          <span class="hud-project-name">${projectName}</span>
          <span class="hud-progress-pct">${done.length}/${total} Done (${donePct}%)</span>
        </div>
        <div class="hud-progress-bar-bg">
          <div class="hud-progress-fill" style="width: ${donePct}%"></div>
        </div>
        <div class="hud-stat-chips">
          <div class="hud-stat-chip human" data-tooltip="Human Approval Gates: Tasks paused waiting for explicit human review and sign-off (e.g. destructive migrations, scope changes, releases). The AI will not proceed without approval.">
            <span class="hud-stat-val">${human.length}</span>
            <span class="hud-stat-lbl">Gates</span>
          </div>
          <div class="hud-stat-chip ready" data-tooltip="Ready Frontier: Tasks with all dependencies met, executable right now by the AI.">
            <span class="hud-stat-val">${ready.length}</span>
            <span class="hud-stat-lbl">Frontier</span>
          </div>
          <div class="hud-stat-chip waiting" data-tooltip="Waiting: Tasks waiting on normal upstream dependencies to complete first.">
            <span class="hud-stat-val">${waiting.length}</span>
            <span class="hud-stat-lbl">Waiting</span>
          </div>
          <div class="hud-stat-chip blocked" data-tooltip="Blocked: Tasks halted by external roadblocks or genuine issues independent of dependencies.">
            <span class="hud-stat-val">${blocked.length}</span>
            <span class="hud-stat-lbl">Blocked</span>
          </div>
          <div class="hud-stat-chip done" data-tooltip="Completed Archive: Tasks finished and verified with passing test evidence.">
            <span class="hud-stat-val">${done.length}</span>
            <span class="hud-stat-lbl">Done</span>
          </div>
        </div>
      </div>

      <!-- 1. Needs Human Approval (Gates) -->
      <div class="hud-section-header">
        <div class="hud-section-title" style="color: #6d28d9;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Needs Human Approval
        </div>
        <span class="hud-section-count" style="background:#f4efff; color:#6d28d9; border-color:#ddd6fe;">${human.length}</span>
      </div>
      ${renderCategoryList(human, 'human', 'human')}

      <!-- 2. Ready Frontier -->
      <div class="hud-section-header" style="margin-top: 6px;">
        <div class="hud-section-title" style="color: #047857;">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
          Ready Frontier (Executable Now)
        </div>
        <span class="hud-section-count" style="background:#e9f7ef; color:#047857; border-color:#bbf7d0;">${ready.length}</span>
      </div>
      ${renderCategoryList(ready, 'ready', 'ready')}

      <!-- 3. Waiting on Dependencies -->
      <div class="hud-section-header" style="margin-top: 6px;">
        <div class="hud-section-title" style="color: #b45309;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>
          Waiting on Dependencies
        </div>
        <span class="hud-section-count" style="background:#fff8e7; color:#b45309; border-color:#fde68a;">${waiting.length}</span>
      </div>
      ${renderCategoryList(waiting, 'waiting', 'waiting')}

      <!-- 4. Blocked Tasks -->
      ${blocked.length > 0 ? `
        <div class="hud-section-header" style="margin-top: 6px;">
          <div class="hud-section-title" style="color: #b91c1c;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            Blocked Tasks
          </div>
          <span class="hud-section-count" style="background:#fff0ee; color:#b91c1c; border-color:#fecaca;">${blocked.length}</span>
        </div>
        ${renderCategoryList(blocked, 'blocked', 'blocked')}
      ` : ''}

      <!-- 5. Completed Archive (Done) -->
      <div class="hud-section-header" style="margin-top: 6px;">
        <div class="hud-section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Completed Archive
        </div>
        <span class="hud-section-count">${done.length}</span>
      </div>
      ${renderCategoryList(done, 'done', 'done')}

      <!-- 5. The Weave Canvas Viewer (Always last section!) -->
      <div id="hud-canvas-section">
        <div class="hud-section-header" style="margin-top: 10px;">
          <div class="hud-section-title" style="color: var(--text);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><circle cx="5" cy="18" r="2.5"/><path d="M5 8.5v7"/><path d="M19 8.5v7"/><path d="M7.5 6h9"/><path d="M7.5 18h9"/><path d="M7 7.5l10 9"/></svg>
            The Weave Canvas Viewer
          </div>
          <button type="button" class="hud-mini-fs-btn" onclick="toggleHudFullscreen()" title="Open Weave Map on PC full screen mode">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            <span>Full Screen</span>
          </button>
        </div>
        <div id="hud-canvas-slot"></div>
      </div>
    `;

    // Safeguard .weave-panel so it is NOT destroyed when container.innerHTML is rewritten
    const panel = getWeavePanel();
    const home = document.getElementById('weave-panel-home') || document.querySelector('.shell') || document.body;
    if (panel && container.contains(panel)) {
      home.appendChild(panel);
    }

    container.innerHTML = html;
    mountCanvasSection();
    requestAnimationFrame(() => {
      if (typeof window.renderTheWeave === 'function') window.renderTheWeave();
    });
  }

  function renderHudCard(t, statusGroup) {
    const isDone = statusGroup === 'done';
    const pClass = (t.priority || 'P2').toLowerCase();

    const verifyCmd = t.verification?.command || '';
    const acceptance = Array.isArray(t.acceptance) ? t.acceptance : [];
    const notes = Array.isArray(t.notes) ? t.notes : [];
    const affected = Array.isArray(t.affectedPaths) ? t.affectedPaths.join(', ') : '';

    return `
      <div class="hud-card hud-card-${statusGroup}">
        <div class="hud-card-header" onclick="toggleCard(this.closest('.hud-card'))">
          <div style="flex:1; min-width:0;">
            <div class="hud-card-id-row">
              <span class="hud-id ${statusGroup}">${t.id}</span>
              <span class="hud-pbadge ${pClass}">${t.priority || 'P2'}</span>
              <span class="hud-ws-pill">${t.workstream || 'General'}</span>
              ${isDone && (t.completedAt || t.completion?.at) ? `
                <span class="hud-time-pill" title="Completed: ${t.completedAt || t.completion?.at}">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  ${formatCompletedDate(t.completedAt || t.completion?.at)}
                </span>
              ` : ''}
            </div>
            <h4 class="hud-card-title ${isDone ? 'done' : ''}">${t.title}</h4>
          </div>
          <button type="button" class="hud-chevron-btn" aria-label="Toggle details">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
          </button>
        </div>

        <div class="hud-card-details">
          ${t.goal ? `<div class="hud-desc"><strong>Goal:</strong> ${t.goal}</div>` : ''}
          ${t.spec ? `<div class="hud-desc" style="color:var(--muted);">${t.spec}</div>` : ''}

          ${verifyCmd ? `
            <div class="hud-cmd-pill" onclick="copyCmd('${verifyCmd}', event)" title="Click to copy command">
              <div class="hud-cmd-left">
                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>${verifyCmd}</span>
              </div>
              <span class="hud-copy-hint">Copy</span>
            </div>
          ` : ''}

          ${acceptance.length ? `
            <div class="hud-acceptance-box">
              <div class="hud-acceptance-title">Acceptance Criteria</div>
              <ul class="hud-acceptance-list">
                ${acceptance.map(a => `<li>${a}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${notes.length ? `
            <div style="margin-top:6px; font-size:10.5px; color:var(--text); font-style:italic;">
              <strong>Note:</strong> ${notes[notes.length - 1]}
            </div>
          ` : ''}

          <div class="hud-meta-row">
            <div class="hud-meta-left">
              ${affected ? `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>${affected}</span>
              ` : ''}
            </div>
            <span>Effort: ${t.effort || 1} pts</span>
          </div>
        </div>
      </div>
    `;
  }

  function formatCompletedDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const m = monthNames[d.getMonth()];
      const day = d.getDate();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${m} ${day}, ${hh}:${mm}`;
    } catch {
      return String(dateStr);
    }
  }

  window.renderSidebarHud = renderSidebarHud;

  function initHud() {
    try {
      document.body.classList.add('hud-mode-active');
      setHudMode('cockpit');
    } catch (err) {
      console.error('WeaveMap HUD initialization error:', err);
    }
  }

  // Immediate init (body and all DOM nodes are parsed)
  initHud();

  window.addEventListener('DOMContentLoaded', initHud);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initHud();
  }
</script>
'@

$bundled = $index.Replace('<link rel="stylesheet" href="style.css">', "<style>`n$style`n$hudCss`n</style>")
$bundled = $bundled.Replace('<script src="state.js"></script>', "<script>`n$state`n</script>")
$bundled = $bundled.Replace('<script src="app.js"></script>', "<script>`n$app`n</script>`n$hudScript")
$bundled = $bundled.Replace('<body>', "<body class=`"hud-mode-active`">`n$hudHtmlBar")

if (-not $ArtifactPath) {
    $dest = Join-Path (Get-Location) "weavemap_hud.html"
} elseif ($ArtifactPath.EndsWith(".html", [System.StringComparison]::OrdinalIgnoreCase)) {
    $dest = $ArtifactPath
} else {
    $dest = Join-Path $ArtifactPath "weavemap_hud.html"
}
$parentDir = Split-Path -Parent $dest
if ($parentDir -and -not (Test-Path $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}
[System.IO.File]::WriteAllText($dest, $bundled, [System.Text.Encoding]::UTF8)
Write-Output "Successfully generated HUD: $dest"
