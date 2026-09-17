# WeaveMap

**Project management for AI. A map for humans.**

**Current runtime:** `v0.7.0` · **State schema:** `v4`

WeaveMap is a tiny, repo-local project manager designed primarily for AI coding agents. The AI maintains the project plan, specs, task state, dependencies, evidence, handoff notes, and its own agent/model identity. The human opens a static execution map to see what is done, what is ready, what is waiting on prerequisites, what is genuinely blocked, and how work progresses through dependency **waves**.

## Drop it into a project

Copy these files into a `weavemap/` folder inside any project:

```text
your-project/
├── src/
├── ...
└── weavemap/
    ├── PROTOCOL.md
    ├── state.js
    ├── index.html
    ├── app.js
    └── style.css
```

Then tell any coding AI:

> Read `weavemap/PROTOCOL.md` and use WeaveMap to manage this project as you work.

The protocol is agent-agnostic. No agent-specific integration is required. Open `weavemap/index.html` in a browser whenever you want to inspect the project.

## Versioning

WeaveMap has two independent versions:

- **Runtime version** — the observer/protocol release, currently `v0.7.0`.
- **State schema version** — the structure of durable project data in `state.js`, currently `v4`.

The runtime version is visible in the WeaveMap header and exposed in the browser as:

```js
window.WEAVEMAP_RUNTIME
// { version: "0.7.0", schemaVersion: 4 }
```

A runtime release does not necessarily require a state migration. The schema changes only when the durable project-data structure changes.

## Waiting is not blocked

Runtime `v0.7.0` separates normal dependency sequencing from real blockers.

- **Ready** — a `todo` task whose hard dependencies are resolved.
- **Waiting** — a `todo` task that cannot start yet because one or more hard dependencies are unfinished. This is normal project sequencing, not a problem.
- **Blocked** — a task explicitly marked `blocked` because of a real obstacle that is not already represented by unfinished dependencies.

The Waiting count includes an on-screen tooltip explaining this distinction. Waiting tasks are also grouped in a collapsible **Waiting on dependencies** section instead of inflating the Blockers list.

## New or already in progress

WeaveMap works both at the beginning of a project and when it is added halfway through an existing one.

On first initialization the AI inspects the host repository and sets the project entry mode automatically:

- **New** — the project is effectively starting from scratch, so the AI creates the initial requirements, tasks, dependencies, and waves.
- **Adopted** — meaningful work already exists, so the AI first creates an evidence-backed baseline of what is established, what is missing or incomplete, and what remains uncertain. It then plans actionable work from that baseline forward.

For adopted projects, WeaveMap does **not** invent historical completed tasks just to reconstruct a fictional timeline. Existing capabilities are recorded separately in the adoption baseline, while the execution map tracks work from the point WeaveMap joins the project.

## Add WeaveMap to an existing project

Give your AI coding agent the WeaveMap repository URL and use this prompt:

> Add WeaveMap to this existing project.  
> From `https://github.com/Srinevasan22/weavemap`, copy the WeaveMap files into a new `weavemap/` folder in this project:
>
> - `PROTOCOL.md`
> - `state.js`
> - `index.html`
> - `app.js`
> - `style.css`
>
> Do not modify the WeaveMap runtime files except `weavemap/state.js` as instructed by the protocol.
>
> Then read `weavemap/PROTOCOL.md`, inspect this existing project, and initialize WeaveMap in adoption mode.
>
> For this first pass, **do not implement or change project code yet**. Only analyze the existing project and populate WeaveMap accurately.

After the analysis, review the adoption baseline, evidence, tasks, dependencies, ready frontier, Waiting section, true blockers, and agent/model information before allowing implementation work to continue.

## Safe updates without losing project data

WeaveMap deliberately separates its **runtime** from your **project data**.

These files are safe to replace during an update:

```text
weavemap/PROTOCOL.md
weavemap/index.html
weavemap/app.js
weavemap/style.css
```

This file is your durable project data and must be preserved:

```text
weavemap/state.js
```

Click the version badge in the observer to open the safe-update instructions and copy an AI update prompt.

The update flow is:

1. Read the existing `state.js` and create a temporary backup.
2. Replace only the four runtime files above from the latest WeaveMap repository.
3. **Never overwrite `state.js` with the blank source template.**
4. Read the newly installed `PROTOCOL.md`.
5. If the new runtime expects a newer schema, migrate the existing `state.js` in place while preserving project knowledge.
6. Validate the observer and resolve any errors.
7. Remove the temporary backup only after validation succeeds.

## Adoption fidelity (schema v4)

Schema v4 makes an AI-created project baseline easier for another AI or human to verify without rescanning the whole repository.

- **Baseline evidence** — established capabilities, gaps, and uncertainties can carry concise repository-relative evidence paths.
- **Gap disposition** — every adoption gap is explicitly `tracked`, `deferred`, or `accepted`. Tracked gaps point to the tasks addressing them.
- **Requirement and decision origin** — knowledge is labeled `user`, `repo`, or `agent`, so AI proposals do not masquerade as established project facts.
- **Hard dependency semantics** — `dependsOn` means a task cannot reasonably be executed or verified before its dependency. Convenience ordering is not a dependency.
- **Acceptance fidelity** — agents must not invent arbitrary numeric targets as though they were existing requirements. Speculative thresholds must be labeled `Proposed:`.
- **Defensive validation** — the observer checks schema compatibility, IDs, statuses, priorities, effort ranges, dependency integrity, cycles, origins, gap references, and task handoff notes.

## Persistent task handoff notes

Every task contains a `notes` array. It is persistent project memory for the **next AI pass on that task**.

```js
{
  id: "T-014",
  title: "Fix scanner regression",
  // ...
  notes: [
    "Failure is isolated to target_05.jpg; outer-ring detection was already ruled out.",
    "Human: Do not change the backend contract while fixing this task.",
    "Next pass: inspect the cluster split threshold before changing Hough parameters."
  ]
}
```

Before an agent starts or resumes a task, the protocol requires it to read the task's notes. Human-written notes are prefixed with `Human:` so agents can distinguish explicit user context from AI-generated handoff notes.

### Merge-safe human note saving

Saving a human note does **not** write the browser's potentially stale in-memory project snapshot back over `state.js`.

Instead WeaveMap:

1. reads the current `state.js` immediately before saving;
2. locates the same task in that latest state;
3. appends only the new `Human:` note;
4. checks whether the file changed during the merge and retries if necessary;
5. writes the merged latest state back.

So you do not need to refresh WeaveMap before writing a note just because an AI may have updated `state.js` since the page was opened.

## No install

WeaveMap has:

- no build step
- no package manager
- no database
- no account
- no cloud service
- no external JavaScript or CSS dependencies

The project state lives in `weavemap/state.js` and travels with the repository.

## Core model

- **Tasks** contain the goal, implementation spec, acceptance criteria, effort, priority, status, hard dependencies, and persistent handoff notes.
- **Dependencies** are the structural source of truth.
- **Waves** are calculated dependency depths, not dates or weeks.
- **Ready frontier** is the set of executable work now.
- **Waiting** is derived automatically from unresolved hard dependencies.
- **Blocked** is reserved for real obstacles that are not ordinary dependency sequencing.
- **Recommended next** prefers active work, then priority, downstream impact, and lower effort.
- **Requirements** record what the project must achieve and where that requirement came from.
- **Decisions** preserve important project choices, why they were made, and their provenance.
- **Agents used** records each unique AI agent/model combination that has managed or worked on the project.
- **Adoption baseline** records established capabilities, gaps, uncertainties, concise evidence, and how gaps are being handled.

The execution map is derived automatically. The AI should not manually assign wave numbers.

## Philosophy

WeaveMap does not try to be Jira or Notion. The AI is the project manager; the human interface is for observability and intervention.

WeaveMap optimizes for **minimum useful AI context**, not minimum bytes on disk. The repository remains the durable shared memory between agents.
