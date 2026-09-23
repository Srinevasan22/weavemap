---
name: weavemap
description: >-
  Project management for AI agents and human observers using WeaveMap. Use when initializing WeaveMap in a project, updating task states, managing dependencies, recording blockers or evidence, upgrading WeaveMap runtime files, or when the user says "update weavemap", "upgrade weavemap", or asks to sync WeaveMap with the latest version.
---

# WeaveMap Integration Skill

WeaveMap is a repo-local project manager designed for AI coding agents and human observers.
The agent maintains project state, dependencies, provenance, requirements, decisions, handoff notes, approval gates, and lightweight completion evidence in `weavemap/state.js`.
The human uses the static browser observer (`weavemap/index.html`) or live side-pane HUD to visualize the project.

---

## 1. Quick Initialization in Any Project

When the user asks to "add WeaveMap", "initialize WeaveMap", or "use WeaveMap" in a project:

1. **Create `weavemap/` directory** at the root of the project.
2. **Copy the runtime files** from this skill's bundled `resources/` directory (or fetch from GitHub raw if unavailable):
   - `resources/PROTOCOL.md` -> `weavemap/PROTOCOL.md`
   - `resources/index.html` -> `weavemap/index.html`
   - `resources/app.js` -> `weavemap/app.js`
   - `resources/style.css` -> `weavemap/style.css`
   - `resources/generate_hud.mjs` -> `weavemap/generate_hud.mjs`
   - `resources/generate_hud.ps1` -> `weavemap/generate_hud.ps1`
3. **Initialize `weavemap/state.js`**:
   - If `weavemap/state.js` does NOT exist, copy `resources/state.template.js` to `weavemap/state.js`.
   - If `weavemap/state.js` already exists, **NEVER** overwrite it!
4. **Determine `project.entryMode`**:
   - `"new"`: If initializing a blank or brand-new project.
   - `"adopted"`: If introducing WeaveMap into an existing codebase. Analyze the repo, create baseline evidence, requirements, and current status.
5. **Record Agent Identity**:
   - Add your agent name and model into `agents: [{ name: "Antigravity", model: "<model_name>" }]`.

---

## 2. Maintaining Project State (`weavemap/state.js`)

- `weavemap/state.js` is the canonical source of truth for project management.
- Always keep `state.js` data-only: JSON-compatible literals wrapped in `window.WEAVEMAP = ...`.
- Do not add functions, imports, computed properties, runtime expressions, or helper variables.
- **Task Status Lifecycle (Schema v4)**:
  - Allowed stored statuses: `"todo"`, `"active"`, `"blocked"`, `"done"`, `"skipped"`.
  - Do NOT store `"ready"`, `"waiting"`, or `"needs_human"` in `state.js`. These are **derived observer states**:
    - **Ready Frontier**: `status: "todo"` with 0 unmet dependencies and no pending approval gate.
    - **Waiting**: `status: "todo"` with 1 or more unfinished dependencies.
    - **Needs Human**: Task has `humanApproval: { required: true, status: "pending" }`.
    - **Blocked**: `status: "blocked"` — real obstacle independent of dependencies (requires reason in `notes`).
- **Task Completion Lifecycle (Mandatory)**:
  When finishing and verifying a task, the agent MUST:
  1. Set `"status": "done"`.
  2. Set `"completedAt": "<ISO 8601 UTC timestamp>"` (e.g. `2026-09-19T13:49:00Z`).
  3. Set `"completion": { "by": "Antigravity", "at": "<ISO 8601 UTC timestamp>", "verification": { "command": "<test command>", "result": "passed", "note": "<what passed>" } }`.
  4. If skipping a task: set `"status": "skipped"`, `"completedAt": "<timestamp>"`, and `"completion": { "by": "Antigravity", "at": "<timestamp>", "verification": { "result": "not-applicable", "note": "<reason>" } }`.
  5. Re-run `generate_hud.mjs` (or `.ps1`) to update the WeaveMap HUD artifact so the observer updates immediately.

---

## 3. When the User Asks to "Update WeaveMap"

When the user says **"update weavemap"**, **"upgrade weavemap"**, or asks to update runtime files to the latest version:

### The Safety Contract
> **CRITICAL**: Never overwrite `weavemap/state.js` with the template or GitHub source during an update. Your durable project tasks, dependencies, requirements, and evidence live in `state.js`. Only the engine/runtime files are replaced.

### Step-by-Step Update Procedure
1. **Verify Project Structure**: Ensure the current project contains a `weavemap/` directory. If not, notify the user and offer to initialize WeaveMap.
2. **Back Up State**: Create a temporary backup copy of `weavemap/state.js` (e.g. `weavemap/state.js.bak`).
3. **Replace Runtime Files**: Replace **only** these runtime files:
   - `weavemap/PROTOCOL.md`
   - `weavemap/index.html`
   - `weavemap/app.js`
   - `weavemap/style.css`
   - `weavemap/generate_hud.mjs`
   - `weavemap/generate_hud.ps1`
   *Source priority:*
   a. If running with the WeaveMap plugin installed: copy from the skill's `resources/` directory.
   b. Otherwise, download directly from the official repository:
      `https://raw.githubusercontent.com/Srinevasan22/weavemap/main/<filename>`
4. **Preserve `state.js`**: Re-verify that `weavemap/state.js` was NOT replaced with a blank template.
5. **Check Schema Compatibility**: Read `schemaVersion` in `weavemap/state.js` and compare with `CURRENT_SCHEMA_VERSION` in the new `weavemap/app.js` or `weavemap/PROTOCOL.md`.
   - If both are schema version `4`, no data migration is necessary.
   - If a schema migration is required, migrate fields in place while preserving all existing tasks, requirements, decisions, and history.
6. **Validate State & DAG**:
   Run the schema and DAG acyclicity validator:
   ```bash
   node weavemap/generate_hud.mjs --check-only -p .
   ```
7. **Clean Up Backup**: Remove `weavemap/state.js.bak` **only** after validation passes.
8. **Update Live HUD**: If a HUD artifact exists or is active, re-generate it:
   ```bash
   node weavemap/generate_hud.mjs -p . -a ./weavemap_hud.html
   ```
9. **Report Summary to User**:
   Provide a concise confirmation reporting:
   - Previous runtime version and new runtime version (e.g. `v1.0.1` -> `v1.0.2`).
   - State schema version (e.g. `v4` — preserved without migration).
   - Validation status (`✔ WeaveMap state valid: X tasks, DAG acyclic`).
   - Confirmation that all project tasks and progress remain intact.

---

## 4. References & Resources

- **Protocol Specification**: [resources/PROTOCOL.md](./resources/PROTOCOL.md)
- **Template State**: [resources/state.template.js](./resources/state.template.js)

---

## 5. Antigravity Native Artifact Side-Pane (Live AI HUD)

When the user asks to see the WeaveMap observer, live HUD, or cockpit view in Antigravity:

1. **Generate the HUD Artifact**:
   Run the bundled cross-platform generator script:
   ```bash
   node "$HOME/.gemini/config/plugins/weavemap/skills/weavemap/resources/generate_hud.mjs" -p "<project_root>" -a "<artifact_dir>/weavemap_hud.html"
   ```
   *(Or on Windows PowerShell: `powershell -ExecutionPolicy Bypass -File "$HOME\.gemini\config\plugins\weavemap\skills\weavemap\resources\generate_hud.ps1" -ProjectPath "<project_root>" -ArtifactPath "<artifact_dir>"`)*

   This compiles the project's `weavemap/` files into a single, self-contained `<artifact_dir>/weavemap_hud.html` featuring:
   - **Dual-Mode Switcher**: `⚡ Sidebar HUD` (vertical stream tailored for 300px–600px IDE side panels) and `🕸️ Full Canvas` (original 2D dependency graph).
   - **Clean Native Palette**: Light and dark mode support with neutral canvas and clear status accents.
   - **Crisp SVG Icons**: Clean vector icons for statuses, chevrons, and workstreams.
   - **Actionable Flight Cards**: Priority badges (`P1`, `P2`), in-place expandable details, and 1-click copy for verification commands.
   - **Collapsible Queues**: Toggleable sections for Waiting and Completed tasks so the Ready Frontier stays front and center.

2. **Register Artifact**:
   Ensure `weavemap_hud.html` is saved with `UserFacing: true` in `ArtifactMetadata`.

3. **Presenting to the User (Side-Pane Focus)**:
   Do not only embed an inline card in chat. Always provide a prominent markdown link so the user can open it in the side pane with a single click:
   ```markdown
   👉 **[Click to open WeaveMap HUD in the Side Pane](file:///<path_to_weavemap_hud.html>)**
   *(Or click **Weavemap Hud** under the Artifacts section in your right panel)*
   ```
