# WeaveMap protocol

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

## Source of truth

`weavemap/state.js` is the canonical project state. The UI derives waves, readiness, blockers, progress, and the recommended next task from it. Do not manually assign wave numbers.

When WeaveMap is embedded in another repository, normally edit only `weavemap/state.js`. Do not modify `weavemap/index.html`, `weavemap/app.js`, or `weavemap/style.css` unless the user is explicitly developing WeaveMap itself.

## Agent and model identity

WeaveMap records which AI agents have worked on the project so the human observer can see the project's AI toolchain.

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
- Never infer or guess a model from the agent/provider name. If the exact model is unavailable, use `null`.
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

Set `adoption` to:

```js
adoption: {
  baselineSummary: "Concise description of the project state when WeaveMap joined.",
  established: [
    "Capabilities or foundations clearly evidenced in the repository"
  ],
  gaps: [
    "Important missing, incomplete, broken, or unfinished areas"
  ],
  uncertainties: [
    "Things the repository does not establish with enough confidence"
  ]
}
```

Adoption rules:

- Only put something in `established` when repository evidence or an explicit user statement supports it.
- Put ambiguous or conflicting findings in `uncertainties`; do not guess.
- Do not invent historical tasks and mark them `done` merely to recreate a fictional project history.
- Existing implemented capabilities belong in the adoption baseline, not as fake completed tasks.
- Create tasks for remaining work, clearly incomplete work, fixes, migrations, cleanup, missing tests, current roadmap items, and other actionable work that exists from the adoption point forward.
- If the repository clearly shows a piece of work already in progress, it may be represented as an `active` task with a note that it predates WeaveMap adoption.
- If future work relies on a capability already present at adoption, treat that capability as an established baseline rather than creating an artificial completed dependency task.
- Progress shown by WeaveMap after adoption reflects the work tracked by WeaveMap from the adoption baseline forward, not the percentage of the project's entire historical lifetime.
- Preserve the user's stated roadmap or current objective when it is available, but verify implementation state against the repository.

The human UI will display the adoption baseline separately from the execution map.

## First initialization

If `weavemap/state.js` has `initialized: false`:

1. Inspect the host project and the user's stated goal.
2. Determine and set `project.entryMode` to `"new"` or `"adopted"`.
3. Set the project name, summary, and current high-level phase.
4. Record your agent/model identity in `agents`.
5. If the project is adopted, create the `adoption` baseline before planning future work. If it is new, leave `adoption` as `null`.
6. Define only the workstreams the project actually needs. Examples may include Product, Architecture, Design, Frontend, Backend, Data, Infrastructure, QA, Security, Release, Mobile, AI, or Documentation. Do not create empty boilerplate workstreams.
7. Add explicit requirements supported by the user's goal, project documentation, or current implementation.
8. Add known architectural/product decisions only when they are actually decided.
9. Decompose actionable remaining work into tasks with meaningful dependency relationships.
10. Validate that dependencies are acyclic and point to real task IDs.
11. Set `initialized: true` before beginning implementation.

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

Effort is a relative AI-work estimate from 1 to 5. A task estimated at 5 should usually be decomposed before execution.

Priority uses `P1` (highest) through `P5` (lowest).

## Execution rules

Before starting development work:

1. Read `weavemap/state.js`.
2. Continue an `active` task when appropriate.
3. Otherwise select a `todo` task whose dependencies are all `done` or `skipped`.
4. Prefer, in order: higher priority, tasks that unblock more downstream work, then lower effort.
5. Set the chosen task to `active` in `weavemap/state.js` before substantial implementation begins.

During work:

- Keep the active task's `spec` and `notes` useful for another agent.
- When new required work is discovered, create a new task in `weavemap/state.js` and connect its dependencies instead of leaving an orphan TODO in chat or code.
- If a discovery changes requirements or architecture, update `requirements` or append a `decision` as appropriate.
- Do not silently rewrite historical decisions; append a superseding decision.
- Use `blocked` only for a real blocker not already represented by unfinished dependencies. Dependency blocking is calculated automatically by the UI.

When work finishes:

1. Verify the acceptance criteria.
2. Set the task to `done` in `weavemap/state.js`.
3. Update project phase if the project has materially moved forward.
4. Re-read the graph before selecting the next task.

## Requirements

Requirements are concise objects:

```js
{ id: "R-001", text: "Users can sign in with email and password.", status: "active" }
```

Use `active`, `satisfied`, or `dropped` for requirement status.

## Decisions

Decisions preserve why the project took a direction:

```js
{
  id: "D-001",
  title: "Use SQLite for local storage",
  rationale: "The application is offline-first and single-user.",
  status: "active",
  supersedes: null
}
```

If a decision changes, add a new decision and set `supersedes` to the previous decision ID.

## Human control

The user remains authoritative. Explicit user instructions can reprioritize, skip, add, remove, or redefine work. Update `weavemap/state.js` so the repo reflects those decisions instead of relying on chat history.

## Using WeaveMap with common AI agents

No special integration is required. The protocol is the same for every agent. The user only needs to point the agent to this file once if the agent does not automatically discover nested project files.

Examples:

- **OpenAI Codex / ChatGPT coding agents:** `Read weavemap/PROTOCOL.md and use WeaveMap to manage this project as you work.`
- **Claude Code:** `Read weavemap/PROTOCOL.md and use WeaveMap as the project-management source of truth.`
- **Gemini CLI:** `Read weavemap/PROTOCOL.md, inspect the repository, and maintain weavemap/state.js while working.`
- **Cursor / Windsurf / Copilot-style agents:** `Before implementing, read weavemap/PROTOCOL.md and follow it for project planning and task state.`
- **Other or future agents:** provide the same instruction: `Read weavemap/PROTOCOL.md and use WeaveMap to manage this project.`

Do not create agent-specific copies of this protocol unless a host project explicitly requires one. `weavemap/PROTOCOL.md` remains the single canonical instruction set.
