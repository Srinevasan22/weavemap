# WeaveMap

**Project management for AI. A map for humans.**

[![WeaveMap Observer Preview](assets/weavemap-observer.png)](https://github.com/Srinevasan22/weavemap)

**Current runtime:** `v1.2.1` · **State schema:** `v4`

WeaveMap is a tiny, repo-local project manager designed primarily for AI coding agents. The AI maintains project state, dependencies, provenance, requirements, decisions, handoff notes, approval gates, verification instructions, requirement coverage, and lightweight completion evidence. The human opens a static observer or live IDE side-pane HUD to see what can run now, what is waiting normally, what genuinely needs intervention, and how work moves through dependency waves.

## Quick Install

Drop WeaveMap into any repository with a single command:

**macOS / Linux / WSL / Git Bash:**
```bash
curl -fsSL https://raw.githubusercontent.com/Srinevasan22/weavemap/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Srinevasan22/weavemap/main/install.ps1 | iex
```

<details>
<summary>Or manually copy the files into your project</summary>

```text
your-project/
├── src/
├── ...
└── weavemap/
    ├── PROTOCOL.md
    ├── state.js
    ├── index.html
    ├── app.js
    ├── core.js
    ├── live_server.mjs
    ├── style.css
    └── generate_hud.mjs
```
</details>

Then tell any coding AI:

> Read `weavemap/PROTOCOL.md` and use WeaveMap to manage this project as you work.

Open `weavemap/index.html` whenever you want to inspect or steer the project in a browser, or run `generate_hud.mjs --serve` for the live HUD.

## GPT / Codex plugin

The root plugin.json uses the Agent Plugins 1.0 manifest. Build the complete, self-contained package with:

```bash
npm run plugin:build
```

The output is `dist/weavemap.tar.gz`, containing the WeaveMap skill and all runtime resources. It excludes this repository's project state, dependencies, Git history, and test outputs. Plugin Creator can create the plugin from that archive.

The skill needs a file-capable agent environment and Node.js 18 or newer. It manages repository files and a local browser HUD; it does not provide a public GPT Action or remote MCP server. Use the installed plugin by asking: **Use WeaveMap to plan and track this project**, or **Open the live WeaveMap HUD**.

## Live HUD and portable snapshots

From this source repository, run:

```bash
npm start
```

For an embedded project installation, run:

```bash
node weavemap/generate_hud.mjs -p . --serve --port 4173
```

Open the localhost URL printed by the command. Use `--port 0` to choose an available port. The server listens only on 127.0.0.1. The HUD polls for external state changes and saves task edits directly to the selected project's state.js. Expand a card and choose **Manage task** to add notes, change priority, approve/reject a gate, or change status.

An open task pauses incoming updates to that dialog. If another writer changes the state, stale saves are rejected: close and reopen the task after the update arrives, then review and retry. Revision checks and atomic replacement reduce conflicting writes; they are not a distributed lock for arbitrary external writers.

To generate a self-contained, offline snapshot:

```bash
node generate_hud.mjs -p . -a ./weavemap_hud.html
```

Snapshots refresh only when regenerated. Editing from a snapshot or index.html prompts for the current state.js, or downloads a merged replacement if direct file writes are unsupported. A downloaded replacement is not saved to the project until you replace the file. Browser/IDE sandboxes may restrict scripts, clipboard, fullscreen or file access.

Windows uses the same generator through a thin wrapper:

```powershell
.\generate_hud.ps1 -ProjectPath . -Serve
.\generate_hud.ps1 -ProjectPath . -CheckOnly
```

Validate state with `npm run validate`; run regression tests with `npm test`. See [AUDIT.md](AUDIT.md) for the inconsistencies fixed in version 1.2.1.

## Versioning

WeaveMap has two independent versions:

- **Runtime version** — observer/protocol release, currently `v1.2.1`.
- **State schema version** — durable project-data structure in `state.js`, currently `v4`.

The runtime version is visible in the observer header and exposed as:

```js
window.WEAVEMAP_RUNTIME
// { version: "1.2.1", schemaVersion: 4 }
```

Runtime `v1.2.1` adds the portable plugin, shared state validation and live editable HUD. Existing schema-v4 projects do **not** require migration. Windows now requires Node.js and delegates to the same generator.

## New or already in progress

WeaveMap works both at the start of a project and when added halfway through an existing one.

- **New** — the AI creates the initial requirements, tasks, dependencies, and execution map.
- **Adopted** — the AI first creates an evidence-backed baseline of established capabilities, gaps, and uncertainties, then tracks actionable work from that point forward.

For adopted projects, WeaveMap does not fabricate historical completed tasks just to make progress look complete.

## Add WeaveMap to an existing project

Give your coding agent the repository URL and use:

> Add WeaveMap to this existing project.  
> From `https://github.com/Srinevasan22/weavemap`, copy `PROTOCOL.md`, `state.js`, `index.html`, `app.js`, and `style.css` into a new `weavemap/` folder.  
> Read `weavemap/PROTOCOL.md`, inspect the existing project, and initialize WeaveMap in adoption mode.  
> For the first pass, do not implement application changes. Only analyze the project and populate WeaveMap accurately.

Then review the baseline, evidence, requirement coverage, dependencies, Ready Frontier, Waiting tasks, genuine Blockers, Needs Human gates, coordination warnings, and agent/model information.

## Safe updates without losing project data

WeaveMap separates replaceable runtime files from durable project data.

Safe to replace:

```text
weavemap/PROTOCOL.md
weavemap/index.html
weavemap/app.js
weavemap/style.css
```

Never overwrite during a runtime update:

```text
weavemap/state.js
```

The version badge opens a safe-update prompt. The update flow is:

1. Back up the existing `state.js`.
2. Replace only the four runtime files.
3. Read the new protocol.
4. Migrate the existing state only if the schema changed.
5. Validate the observer.
6. Remove the backup only after validation succeeds.

You can also tell an AI:

> Update WeaveMap in this project to the latest version from `https://github.com/Srinevasan22/weavemap`. Back up `weavemap/state.js`, replace only `PROTOCOL.md`, `index.html`, `app.js`, and `style.css`, `core.js`, `live_server.mjs`, never replace the project's state with the blank template, read the new protocol, migrate only if the schema changed, preserve all project knowledge, validate, and delete the backup only after validation passes.

## Core execution model

[![WeaveMap Execution Map](assets/weavemap-execution-map.png)](https://github.com/Srinevasan22/weavemap)

- **Tasks** contain goal, implementation spec, acceptance criteria, priority, effort, status, dependencies, and handoff notes.
- **Dependencies** are hard execution dependencies.
- **Weave depth** is calculated dependency depth, not dates, weeks, or sequential project stages.
- **Ready** means the AI can work on it now.
- **Waiting** means a normal unfinished dependency exists. This is not a problem.
- **Blocked** means a genuine obstacle independent of normal dependency sequencing.
- **Needs human** means an explicit human approval gate has reached the point where a user decision is required.
- **Ready Frontier** is the AI-executable work available now.

The observer includes tooltips so Waiting and Needs Human are not confused with blockers.\n\n**The Weave** is derived entirely from the host project's `state.js`: workstreams, task IDs, depths, and dependency curves are never hard-coded to a particular project.

## Human control

The observer can steer the project directly through merge-safe edits to the latest `state.js`:

- add human handoff notes;
- change priority;
- approve or reject human gates;
- mark done as an explicit human verification override;
- skip;
- block with a reason;
- reopen.

Human actions are written into the latest state rather than overwriting a stale browser snapshot.

### Human approval gates

Use optional task metadata when work must not be treated as authorized without explicit user approval:

```js
humanApproval: {
  required: true,
  status: "pending"
}
```

A pending gate appears under **Needs human**. The AI must not approve it by assumption. Typical uses include art direction, product scope, publishing, destructive migrations, and release approval.

## Agent execution metadata

Optional fields reduce rediscovery and make multi-agent work safer.

### Task origin

```js
origin: "user" // or "repo" / "agent"
```

This makes the source of work visible. `origin: "agent"` means AI-proposed work, not automatically committed product scope.

### Requirement coverage

```js
requirementIds: ["R-002", "R-006"]
```

The observer derives active requirement coverage from these links and highlights active requirements with no non-skipped task coverage. This is a planning signal, not automatically an error.

### Expected edit scope

```js
affectedPaths: [
  "scanner_v2/test_samples/**"
]
```

This is advisory, not a file lock. WeaveMap now compares `affectedPaths` for ready/active tasks and surfaces likely parallel-edit collisions as coordination warnings.

### Verification command

```js
verification: {
  command: "py scanner_v2/test_regression.py"
}
```

The browser does not execute this command. It is an instruction for the coding agent so it can prove acceptance without rediscovering the correct test command every session.

### Structured verification result

New task completions can record exactly what happened:

```js
completion: {
  by: "Antigravity",
  commit: "dbf2d95",
  verification: {
    command: "py scanner_v2/test_regression.py",
    result: "passed"
  }
}
```

Supported results are `passed`, `failed`, `not-run`, `human-override`, and `not-applicable`. A task cannot validly be `done` with a structured `failed` result.

Legacy v0.9 string-form verification remains readable, but agents should use the structured form for new completions.

## Search and scaling

For larger projects, the observer now includes:

- task search across IDs, titles, specs, notes, workstreams, expected paths, origins, and linked requirement IDs;
- workstream filter;
- state filter;
- Hide Done toggle;
- Compact / Detailed card toggle;
- derived requirement coverage;
- derived path-overlap coordination warnings;
- separate Waiting, Needs Human, and genuine Blockers sections.

The map remains useful for architecture and dependency visibility, while the Ready Frontier / Needs Human / Blockers panels support day-to-day work.

## Persistent task handoff notes

Every task has `notes: []`. Agents must read them before starting or resuming work.

Use them for concise context such as findings already checked, test results, failed approaches, useful file paths/commands, environment caveats, user clarifications, and what the next pass should try.

Human notes are prefixed `Human:`.

The observer's note editor re-reads the latest `state.js`, merges only the new note, checks for concurrent changes, and writes the merged result. You do not need to refresh first just because an AI may have changed the state file.

## Adoption fidelity

Schema v4 keeps adopted-project knowledge verifiable:

- baseline findings can carry concise evidence paths;
- gaps are `tracked`, `deferred`, or `accepted`;
- tracked gaps point to tasks;
- requirements and decisions carry `origin: "user" | "repo" | "agent"`;
- agent-origin scope is explicitly provisional, not automatically committed production scope;
- the observer validates IDs, statuses, priorities, effort, dependencies, cycles, provenance, requirement links, gaps, notes, approval metadata, verification metadata, affected paths, and completion metadata.

## Planning-quality rules

WeaveMap tells agents to:

- split tasks that contain multiple independently testable outcomes, even if total effort is below 5;
- use `dependsOn` only for true hard dependencies;
- run a dependency sanity pass after initial planning or major replanning;
- review uncovered active requirements before finalizing a plan;
- keep agent-proposed scope provisional until the user commits to it;
- create explicit human approval gates for material scope decisions;
- check `affectedPaths` overlap before parallel work;
- record verification results rather than merely claiming a task is done.

## No install

WeaveMap has:

- no build step;
- no package manager;
- no database;
- no account;
- no cloud service;
- no external JavaScript or CSS dependencies.

Project state travels with the repository in `weavemap/state.js`.

## Philosophy

WeaveMap does not try to be Jira, Trello, or Notion. The AI is the project manager; the human interface is for observability and intervention.

WeaveMap optimizes for **minimum useful AI context**, not minimum bytes on disk.
