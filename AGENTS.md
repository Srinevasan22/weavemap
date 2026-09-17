# WeaveMap agent protocol

WeaveMap is project management for AI agents, with a lightweight human observer UI.

## Source of truth

`state.js` is the canonical project state. The UI derives waves, readiness, blockers, progress, and the recommended next task from it. Do not manually assign wave numbers.

When WeaveMap is embedded in another repository, normally edit only `state.js`. Do not modify `index.html`, `app.js`, or `style.css` unless the user is explicitly developing WeaveMap itself.

## First initialization

If `initialized` is `false`:

1. Inspect the host project and the user's stated goal.
2. Set the project name, summary, and current high-level phase.
3. Define only the workstreams the project actually needs. Examples may include Product, Architecture, Design, Frontend, Backend, Data, Infrastructure, QA, Security, Release, Mobile, AI, or Documentation. Do not create empty boilerplate workstreams.
4. Add explicit requirements.
5. Add known architectural/product decisions only when they are actually decided.
6. Decompose the work into tasks with meaningful dependency relationships.
7. Validate that dependencies are acyclic and point to real task IDs.
8. Set `initialized: true` before beginning implementation.

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

1. Read `state.js`.
2. Continue an `active` task when appropriate.
3. Otherwise select a `todo` task whose dependencies are all `done` or `skipped`.
4. Prefer, in order: higher priority, tasks that unblock more downstream work, then lower effort.
5. Set the chosen task to `active` before substantial implementation begins.

During work:

- Keep the active task's `spec` and `notes` useful for another agent.
- When new required work is discovered, create a new task and connect its dependencies instead of leaving an orphan TODO in chat or code.
- If a discovery changes requirements or architecture, update `requirements` or append a `decision` as appropriate.
- Do not silently rewrite historical decisions; append a superseding decision.
- Use `blocked` only for a real blocker not already represented by unfinished dependencies. Dependency blocking is calculated automatically by the UI.

When work finishes:

1. Verify the acceptance criteria.
2. Set the task to `done`.
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

The user remains authoritative. Explicit user instructions can reprioritize, skip, add, remove, or redefine work. Update `state.js` so the repo reflects those decisions instead of relying on chat history.
