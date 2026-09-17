# WeaveMap protocol

**Runtime version:** `0.7.0`  
**Current state schema:** `4`

WeaveMap is project management for AI agents, with a lightweight human observer UI.

This protocol is agent-agnostic. Any AI coding agent that can read and edit repository files can use WeaveMap.

## Embedded location

WeaveMap is intended to live inside the host repository as a `weavemap/` folder.

When you are asked to initialize or use WeaveMap in a host project:

1. Read `weavemap/PROTOCOL.md` completely.
2. Inspect the host project outside the `weavemap/` folder.
3. Read and maintain `weavemap/state.js` as the canonical project-management state.
4. Record your agent identity in `weavemap/state.js` as described below.
5. Use the host repository, not chat history, as the authoritative context for continuing work.

Do not assume any root-level agent instruction file belongs to WeaveMap.

## Runtime version and safe updates

WeaveMap intentionally separates the **runtime** from the **project data**.

Updatable runtime files:

```text
weavemap/PROTOCOL.md
weavemap/index.html
weavemap/app.js
weavemap/style.css
```

Durable project data:

```text
weavemap/state.js
```

`state.js` must never be replaced with the blank `state.js` template from the WeaveMap source repository when updating an existing installation.

The observer displays both the WeaveMap runtime version and the project's state schema. Runtime metadata is also available in the browser as:

```js
window.WEAVEMAP_RUNTIME
// { version: "0.7.0", schemaVersion: 4 }
```

When asked to update WeaveMap in a host project:

1. Read the existing `weavemap/state.js` before changing anything.
2. Make a temporary backup of that exact state file.
3. Replace only `PROTOCOL.md`, `index.html`, `app.js`, and `style.css` with the latest runtime files.
4. Never replace the project's `state.js` with the source repository template.
5. Read the newly installed `PROTOCOL.md` completely.
6. Compare the existing state `schemaVersion` with the schema expected by the new runtime.
7. If migration is required, migrate the **existing state in place**. Preserve project metadata, adoption findings and evidence, requirements, decisions, task IDs, statuses, dependencies, acceptance criteria, handoff notes, agents, and other project knowledge except where a compatible structural migration explicitly requires reshaping it.
8. Validate the observer and resolve every WeaveMap validation error.
9. Remove the temporary backup only after validation succeeds.
10. Do not change host application code as part of a WeaveMap runtime update unless the user separately asked for application work.

If the state schema is newer than the installed runtime supports, update the runtime before editing state.

## Source of truth

`weavemap/state.js` is the canonical project state. The UI derives waves, readiness, waiting, blockers, progress, and the recommended next task from it. Do not manually assign wave numbers.

When WeaveMap is embedded in another repository, normally edit only `weavemap/state.js`. Do not modify `weavemap/index.html`, `weavemap/app.js`, or `weavemap/style.css` unless the user is explicitly developing WeaveMap itself or updating the runtime.

Keep `state.js` data-only: use JSON-compatible literals wrapped in `window.WEAVEMAP = ...`. Do not add functions, imports, computed properties, runtime expressions, or helper variables.

## Agent and model identity

Ensure `weavemap/state.js` contains an `agents` array. When you first work on the project, add one entry for your current agent/model combination if it is not already present:

```js
agents: [
  { name: "Codex", model: "GPT-5.6 Sol" },
  { name: "Claude Code", model: null }
]
```

Rules:

- `name` is the agent or coding environment actually doing the work, such as `Codex`, `ChatGPT`, `Claude Code`, `Gemini CLI`, `Cursor`, `Windsurf`, or `GitHub Copilot`.
- `model` is the exact model only when you can reliably identify it from your environment or system context.
- Never infer or guess a model from the agent/provider name. If unavailable, use `null`.
- Do not duplicate an existing identical `name` + `model` pair.
- If the same agent later uses a different known model, add a separate entry.
- Keep this lightweight: do not add timestamps, token counts, or per-session logs unless the schema is explicitly extended later.

## Initialization mode

WeaveMap supports both brand-new projects and projects that already contain substantial work.

During first initialization, determine the entry mode from the repository itself:

- Set `project.entryMode` to `"new"` when the host project is effectively starting from scratch.
- Set `project.entryMode` to `"adopted"` when meaningful application code, infrastructure, tests, documentation, deployment configuration, or other project work already exists.

Do not ask the user which mode to use when the repository makes the answer clear.

## Adopting an existing project

When `project.entryMode` is `"adopted"`, treat initialization as a baseline analysis rather than a greenfield plan.

Inspect the current repository carefully, including relevant source code, configuration, documentation, tests, CI/deployment files, schemas, TODOs, and version history when available and useful. Reconstruct the present state of the project, not an imagined history of how it got there.

Use this v4 adoption structure:

```js
adoption: {
  baselineSummary: "Concise description of the project state when WeaveMap joined.",
  established: [
    {
      text: "Capability clearly established by repository evidence.",
      evidence: ["relative/path/to/file.ext"]
    }
  ],
  gaps: [
    {
      text: "Important missing, incomplete, broken, or unfinished area.",
      evidence: ["relative/path/to/file.ext"],
      taskIds: ["T-004"],
      disposition: "tracked"
    }
  ],
  uncertainties: [
    {
      text: "Something the repository does not establish confidently.",
      evidence: []
    }
  ]
}
```

Adoption rules:

- Only put something in `established` when repository evidence or an explicit user statement supports it.
- When a repository path supports a finding, record the smallest useful set of repository-relative paths in `evidence`.
- Prefer 1–3 high-value evidence paths over exhaustive lists.
- Put ambiguous or conflicting findings in `uncertainties`; do not guess.
- Do not invent historical tasks and mark them `done` merely to recreate a fictional project history.
- Existing implemented capabilities belong in the adoption baseline, not as fake completed tasks.
- Create tasks for remaining work, incomplete work, fixes, migrations, cleanup, missing tests, current roadmap items, and other actionable work from the adoption point forward.
- If the repository clearly shows work already in progress, it may be represented as `active` with a note that it predates WeaveMap adoption.
- If future work relies on a capability already present at adoption, treat that capability as an established baseline rather than creating an artificial completed dependency task.
- Every adoption gap must have a disposition: `tracked`, `deferred`, or `accepted`.
- A `tracked` gap must reference at least one real task ID in `taskIds`.
- `deferred` means intentionally postponed and should not silently block current execution.
- `accepted` means the user or project has consciously accepted the gap or risk for now.
- Progress after adoption reflects work tracked from the adoption baseline forward, not the percentage of the project's entire historical lifetime.
- Preserve the user's stated roadmap or current objective when available, but verify implementation state against the repository.

## First initialization

If `weavemap/state.js` has `initialized: false`:

1. Inspect the host project and the user's stated goal.
2. Determine and set `project.entryMode` to `"new"` or `"adopted"`.
3. Set project name, summary, and current high-level phase.
4. Record your agent/model identity in `agents`.
5. If adopted, create the evidence-backed `adoption` baseline before planning future work. If new, leave `adoption` as `null`.
6. Define only workstreams the project actually needs.
7. Add explicit requirements supported by the user's goal, project documentation, repository evidence, or clearly labeled agent proposals.
8. Add known architectural/product decisions only when actually decided; distinguish discovered decisions from agent proposals.
9. Decompose actionable remaining work into tasks with meaningful dependency relationships.
10. Validate that dependencies are acyclic and point to real task IDs.
11. Ensure every adoption gap is tracked, deferred, or accepted.
12. Set `initialized: true` before beginning implementation.

## Task schema

Every task should contain:

```js
{
  id: "T-001",
  title: "Short action-oriented title",
  workstream: "Backend",
  phase: "Foundation",
  status: "todo",
  priority: "P1",
  effort: 2,
  dependsOn: [],
  goal: "Why this task exists.",
  spec: "Enough implementation detail for another agent to continue without the original chat.",
  acceptance: ["Observable completion condition"],
  notes: []
}
```

Allowed task statuses: `todo`, `active`, `blocked`, `done`, `skipped`.

Effort is a relative AI-work estimate from 1 to 5. A task estimated at 5 should usually be decomposed before execution. If a task contains several independently testable outcomes, split it even when total effort is below 5.

Priority uses `P1` (highest) through `P5` (lowest).

## Task notes are persistent handoff memory

Every task must have a `notes` array. Notes are concise, persistent context for the next AI pass on that task.

Before starting or continuing a task, read its `notes` before making implementation decisions. This applies even when the same agent is returning in a later session.

Use notes for information that is useful to the next pass but does not belong in the stable specification, such as:

- partial findings and what has already been checked;
- important file paths, commands, test results, or environment caveats;
- failed approaches that should not be repeated;
- user clarifications specific to the task;
- implementation gotchas or unresolved questions;
- handoff context when a task remains active or becomes blocked.

Keep notes short and actionable. Do not copy chat transcripts or duplicate the task `spec`. Update or remove stale AI notes when they would mislead the next agent.

Human-written notes are prefixed with `Human:`. Treat them as explicit user context/instructions for that task unless the user later supersedes them. Do not silently delete or rewrite them merely because an agent disagrees.

The observer's human note editor is merge-safe: immediately before saving, it re-reads the current `state.js`, finds the task in that latest state, appends only the new human note, and writes the merged state back. If the file changes during that operation, WeaveMap retries against the newer file.

## Dependency semantics

`dependsOn` is a **hard execution dependency**.

Add `A` to `B.dependsOn` only when task B cannot reasonably be executed or verified until task A is complete. Do not use hard dependencies merely because one task would be cleaner, nicer, safer, or more convenient to do first.

If two tasks are independent, leave them independent so WeaveMap can expose parallel work in the ready frontier.

Before adding a dependency, ask:

> Would it be valid and useful to execute the downstream task now if the upstream task were still unfinished?

If yes, do not add the dependency.

After building or materially changing the graph, perform a dependency sanity pass and remove convenience-only dependencies.

## Waiting versus blocked

WeaveMap derives **Waiting** automatically. Waiting is not a task status stored in `state.js`.

- **Ready** = `status: "todo"` and every hard dependency is `done` or `skipped`.
- **Waiting** = `status: "todo"` and one or more hard dependencies are unfinished.
- **Blocked** = `status: "blocked"` because of a real obstacle that is not ordinary dependency sequencing.

Do **not** mark a task `blocked` simply because another tracked task must finish first. Represent that relationship with `dependsOn`; the UI will show the downstream task as Waiting automatically.

Use `blocked` only for things such as missing credentials, unavailable hardware, an unresolved external decision, inaccessible data, or another genuine obstacle not already represented by the graph.

The observer includes a tooltip on Waiting explaining that it is normal dependency sequencing, not a problem or blocker.

## Execution rules

Before starting development work:

1. Read `weavemap/state.js`.
2. Continue an `active` task when appropriate.
3. Otherwise select a `todo` task whose dependencies are all `done` or `skipped`.
4. Prefer, in order: higher priority, tasks that unblock more downstream work, then lower effort.
5. Read the selected task's `notes` completely before deciding how to proceed.
6. Set the chosen task to `active` before substantial implementation begins.

During work:

- Keep the active task's `spec` stable enough for another agent to understand the intended work.
- Add or update `notes` when a finding, failed approach, caveat, user clarification, or partial result would save the next pass from rediscovering it.
- When pausing unfinished work, leave a useful handoff note when there is non-obvious context to preserve.
- When new required work is discovered, create a task in `state.js` and connect only true hard dependencies instead of leaving an orphan TODO in chat or code.
- If a discovery changes requirements or architecture, update `requirements` or append a `decision` as appropriate.
- Do not silently rewrite historical decisions; append a superseding decision.
- If new work corresponds to an adoption gap, update that gap's `taskIds` and disposition.
- Use `blocked` only for a real obstacle not already represented by unfinished dependencies.

When work finishes:

1. Verify the acceptance criteria.
2. Remove or revise stale AI handoff notes while preserving notes still useful for maintenance or downstream tasks.
3. Set the task to `done`.
4. Update related adoption gap dispositions if the work closes or changes a gap.
5. Update project phase if the project materially moved forward.
6. Re-read the graph before selecting the next task.

## Acceptance criteria fidelity

Acceptance criteria may be inferred or proposed by the agent when needed, but they must not masquerade as established project requirements.

- Do not invent arbitrary numeric thresholds, time limits, performance targets, compatibility guarantees, or regulatory requirements unless supported by the user, repository documentation, code, tests, or another explicit source.
- If no source establishes a numeric threshold, prefer a qualitative observable criterion.
- If a speculative numeric threshold is useful, label it explicitly as `Proposed:`.

Example:

```js
acceptance: [
  "BLE connection recovers after temporary signal loss without losing the active session.",
  "Proposed: reconnection completes within 10 seconds under the reference test setup."
]
```

## Requirements

Requirements are concise objects with provenance:

```js
{
  id: "R-001",
  text: "Users can sign in with email and password.",
  status: "active",
  origin: "repo",
  evidence: ["docs/auth.md", "backend/routes/auth.js"]
}
```

Allowed requirement statuses: `active`, `satisfied`, `dropped`.

Allowed origins:

- `user` — explicitly stated by the user.
- `repo` — established by repository code, tests, documentation, configuration, or version history.
- `agent` — proposed or inferred by the AI and not yet established by the user or repository.

For `repo` requirements, include concise repository-relative evidence paths when available. For `user` or `agent` origins, `evidence` may be empty.

Agent-origin scope proposals are provisional. Do not automatically expand them into a large downstream production plan as though the user had committed to that scope.

## Decisions

Decisions preserve why the project took a direction and where that knowledge came from:

```js
{
  id: "D-001",
  title: "Use SQLite for local storage",
  rationale: "The application is offline-first and single-user.",
  status: "active",
  supersedes: null,
  origin: "repo",
  evidence: ["src/storage/database.dart"]
}
```

Allowed decision statuses: `active`, `superseded`.

Use the same `origin` values as requirements: `user`, `repo`, or `agent`.

If a decision changes, add a new decision and set `supersedes` to the previous decision ID. Mark the previous decision `superseded`.

## State validation expectations

Before relying on the graph, ensure the state is internally valid. At minimum:

- state schema matches the schema supported by the installed runtime;
- task, requirement, and decision IDs are unique within their collections;
- task statuses are one of `todo`, `active`, `blocked`, `done`, `skipped`;
- priorities are `P1` through `P5`;
- effort is an integer from 1 through 5;
- every task has a `notes` array containing only strings;
- all dependencies reference real task IDs;
- the dependency graph is acyclic;
- requirement and decision statuses are valid;
- requirement and decision origins are `user`, `repo`, or `agent`;
- adopted projects have an adoption baseline;
- adoption gap dispositions are `tracked`, `deferred`, or `accepted`;
- every tracked gap references at least one real task;
- every gap `taskIds` entry references a real task.

The observer performs defensive validation, but agents should avoid writing invalid state in the first place.

## Human control

The user remains authoritative. Explicit user instructions can reprioritize, skip, add, remove, defer, accept, or redefine work. Update `state.js` so the repository reflects those decisions instead of relying on chat history.

## Using WeaveMap with common AI agents

No special integration is required. The protocol is the same for every agent. The user only needs to point the agent to this file once if the agent does not automatically discover nested project files.

Examples:

- **OpenAI Codex / ChatGPT coding agents:** `Read weavemap/PROTOCOL.md and use WeaveMap to manage this project as you work.`
- **Claude Code:** `Read weavemap/PROTOCOL.md and use WeaveMap as the project-management source of truth.`
- **Gemini CLI:** `Read weavemap/PROTOCOL.md, inspect the repository, and maintain weavemap/state.js while working.`
- **Cursor / Windsurf / Copilot-style agents:** `Before implementing, read weavemap/PROTOCOL.md and follow it for project planning and task state.`
- **Other agents:** use the same instruction: `Read weavemap/PROTOCOL.md and use WeaveMap to manage this project.`

Do not create agent-specific copies of this protocol unless a host project explicitly requires one. `weavemap/PROTOCOL.md` remains the single canonical instruction set.
