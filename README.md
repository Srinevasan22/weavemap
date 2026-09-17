# WeaveMap

**Project management for AI. A map for humans.**

**Current runtime:** `v0.5.0` · **State schema:** `v4`

WeaveMap is a tiny, repo-local project manager designed primarily for AI coding agents. The AI maintains the project plan, specs, task state, dependencies, evidence, handoff notes, and its own agent/model identity. The human opens a static execution map to see what is done, what is ready, what is blocked, which AI agents have worked on the project, and how work progresses through dependency **waves**.

## Drop it into a project

Copy this repository's files into a `weavemap/` folder inside any project:

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

The protocol is agent-agnostic. No agent-specific integration is required.

Open `weavemap/index.html` in a browser whenever you want to inspect the project.

## Versioning

WeaveMap has two independent versions:

- **Runtime version** — the observer/protocol release, currently `v0.5.0`.
- **State schema version** — the structure of project data in `state.js`, currently `v4`.

The runtime version is visible directly in the WeaveMap header. The same metadata is exposed in the browser as:

```js
window.WEAVEMAP_RUNTIME
// { version: "0.5.0", schemaVersion: 4 }
```

A runtime patch or feature release does not necessarily require a state migration. The state schema only changes when the durable project-data structure changes.

## New or already in progress

WeaveMap works both at the beginning of a project and when it is added halfway through an existing one.

On first initialization the AI inspects the host repository and sets the project entry mode automatically:

- **New** — the project is effectively starting from scratch, so the AI creates the initial requirements, tasks, dependencies, and waves.
- **Adopted** — meaningful work already exists, so the AI first creates an evidence-backed baseline of what is established, what is missing or incomplete, and what remains uncertain. It then plans actionable work from that baseline forward.

For adopted projects, WeaveMap does **not** invent historical completed tasks just to reconstruct a fictional timeline. Existing capabilities are recorded separately in the adoption baseline, while the execution map tracks work from the point WeaveMap joins the project.

## Add WeaveMap to an existing project

If you are already working on a project, give your AI coding agent the WeaveMap repository URL and ask it to copy the files into the project.

Use this prompt:

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

After the analysis is complete, open `weavemap/index.html` and review the adoption baseline, evidence, tasks, dependencies, ready frontier, blockers, and agent/model information before allowing the agent to continue implementation work.

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

The version badge in the observer is also an **Update WeaveMap** control. Click it to open the safe-update instructions and copy an AI update prompt.

The update flow is:

1. Read the existing `state.js` and create a temporary backup.
2. Replace only the four runtime files above from the latest WeaveMap repository.
3. **Never overwrite `state.js` with the blank source template.**
4. Read the newly installed `PROTOCOL.md`.
5. If the new runtime expects a newer schema, migrate the existing `state.js` in place while preserving all project knowledge.
6. Open the observer and resolve any validation errors.
7. Remove the temporary backup only after validation succeeds.

You can also give an AI this directly:

> Update WeaveMap in this project to the latest version from `https://github.com/Srinevasan22/weavemap`. Before changing anything, read and temporarily back up `weavemap/state.js`. Replace only `PROTOCOL.md`, `index.html`, `app.js`, and `style.css`. Never replace the project's `state.js` with the source template. Read the new protocol, migrate the existing state in place only if the schema changed, preserve all project knowledge and handoff notes, validate the observer, and remove the backup only after validation succeeds. Do not change application code as part of the WeaveMap update.

This makes WeaveMap itself replaceable while the project's project-management memory survives across versions.

## Adoption fidelity (schema v4)

Schema v4 makes an AI-created project baseline easier for another AI or human to verify without rescanning the whole repository.

- **Baseline evidence** — established capabilities, gaps, and uncertainties can carry concise repository-relative evidence paths.
- **Gap disposition** — every adoption gap is explicitly `tracked`, `deferred`, or `accepted`. Tracked gaps point to the tasks addressing them.
- **Requirement and decision origin** — knowledge is labeled `user`, `repo`, or `agent`, so AI proposals do not masquerade as established project facts.
- **Hard dependency semantics** — `dependsOn` means a task cannot reasonably be executed or verified before its dependency. Convenience ordering is not a dependency.
- **Acceptance fidelity** — agents must not invent arbitrary numeric targets as if they were existing requirements. Speculative thresholds must be labeled `Proposed:`.
- **Defensive validation** — the observer checks schema compatibility, IDs, statuses, priorities, effort ranges, dependency integrity, cycles, origins, gap references, and task handoff notes.

The goal is not maximum metadata. It is the smallest amount of provenance that makes AI handoffs reliable while avoiding repeated full-repository analysis.

## Persistent task handoff notes

Every task contains a `notes` array. It is persistent project memory for the **next AI pass on that task**.

```js
{
  id: "T-014",
  title: "Fix scanner regression",
  // ...
  notes: [
    "Failure is isolated to target_05.jpg; outer-ring detection was already ruled out.",
    "Next pass: inspect the cluster split threshold before changing Hough parameters."
  ]
}
```

Before an agent starts or resumes a task, the WeaveMap protocol requires it to read the task's notes. During work, the agent should preserve concise findings, failed approaches, useful paths, test results, user clarifications, blockers, and other context that would otherwise have to be rediscovered in a later session.

Notes are not a chat log or permanent history. They should remain short, actionable, and updated when information becomes stale.

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
- **Task notes** carry concise context that the next AI pass must review before continuing the task.
- **Dependencies** are the structural source of truth.
- **Waves** are calculated dependency depths, not dates or weeks.
- **Ready frontier** is the set of work that can execute now.
- **Recommended next** prefers active work, then priority, downstream impact, and lower effort.
- **Requirements** record what the project must achieve and where that requirement came from.
- **Decisions** preserve important project choices, why they were made, and their provenance.
- **Agents used** records each unique AI agent/model combination that has managed or worked on the project. Agents record the exact model only when they can reliably identify it; otherwise the model remains unknown.
- **Adoption baseline** records established capabilities, gaps, uncertainties, concise evidence, and how gaps are being handled.

The execution map is derived automatically. The AI should not manually assign wave numbers.

## Philosophy

WeaveMap does not try to be Jira or Notion. The AI is the project manager; the human interface is for observability and intervention.

WeaveMap optimizes for **minimum useful AI context**, not minimum bytes on disk. The repository remains the durable shared memory between agents.
