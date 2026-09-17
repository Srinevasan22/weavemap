# WeaveMap

**Project management for AI. A map for humans.**

WeaveMap is a tiny, repo-local project manager designed primarily for AI coding agents. The AI maintains the project plan, specs, task state, dependencies, evidence, and its own agent/model identity. The human opens a static execution map to see what is done, what is ready, what is blocked, which AI agents have worked on the project, and how work progresses through dependency **waves**.

## Drop it into a project

Copy this repository's runtime files into a `weavemap/` folder inside any project:

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

## New or already in progress

WeaveMap works both at the beginning of a project and when it is added halfway through an existing one.

On first initialization the AI inspects the host repository and sets the project entry mode automatically:

- **New** — the project is effectively starting from scratch, so the AI creates the initial requirements, tasks, dependencies, and waves.
- **Adopted** — meaningful work already exists, so the AI first creates an evidence-backed baseline of what is established, what is missing or incomplete, and what remains uncertain. It then plans actionable work from that baseline forward.

For adopted projects, WeaveMap does **not** invent historical completed tasks just to reconstruct a fictional timeline. Existing capabilities are recorded separately in the adoption baseline, while the execution map tracks work from the point WeaveMap joins the project.

## Add WeaveMap to an existing project

If you are already working on a project, give your AI coding agent the WeaveMap repository URL and ask it to copy the runtime files into the project.

Use this prompt:

> Add WeaveMap to this existing project.  
> From `https://github.com/Srinevasan22/weavemap`, copy the WeaveMap runtime files into a new `weavemap/` folder in this project:
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

This first-pass analysis is intentionally separate from development. It lets you verify that the agent has understood the existing project correctly before WeaveMap becomes the project's ongoing project-management source of truth.

## Adoption fidelity (schema v4)

Schema v4 makes an AI-created project baseline easier for another AI or human to verify without rescanning the whole repository.

- **Baseline evidence** — established capabilities, gaps, and uncertainties can carry concise repository-relative evidence paths.
- **Gap disposition** — every adoption gap is explicitly `tracked`, `deferred`, or `accepted`. Tracked gaps point to the tasks addressing them.
- **Requirement and decision origin** — knowledge is labeled `user`, `repo`, or `agent`, so AI proposals do not masquerade as established project facts.
- **Hard dependency semantics** — `dependsOn` means a task cannot reasonably be executed or verified before its dependency. Convenience ordering is not a dependency.
- **Acceptance fidelity** — agents must not invent arbitrary numeric targets as if they were existing requirements. Speculative thresholds must be labeled `Proposed:`.
- **Defensive validation** — the observer checks IDs, statuses, priorities, effort ranges, dependency integrity, cycles, origins, and adoption gap references.

The goal is not maximum metadata. It is the smallest amount of provenance that makes AI handoffs reliable while avoiding repeated full-repository analysis.

## Updating an existing WeaveMap copy

If a project already contains an older WeaveMap version, replace `PROTOCOL.md`, `index.html`, `app.js`, and `style.css` with the current runtime files, but preserve the project's existing `state.js` until an AI has read it.

Then tell the AI:

> Read the current `weavemap/PROTOCOL.md`, migrate `weavemap/state.js` to the current schema without losing project knowledge, validate it, and do not change application code during the migration.

For schema v4, the main migration is converting adoption findings to structured objects, adding gap dispositions/task references, and adding `origin`/`evidence` to requirements and decisions.

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

- **Tasks** contain the goal, implementation spec, acceptance criteria, effort, priority, status, and hard dependencies.
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
