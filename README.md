# WeaveMap

**Project management for AI. A map for humans.**

WeaveMap is a tiny, repo-local project manager designed primarily for AI coding agents. The AI maintains the project plan, specs, task state, and dependencies. The human opens a static execution map to see what is done, what is ready, what is blocked, and how work progresses through dependency **waves**.

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

The protocol is agent-agnostic and includes examples for common AI coding agents. No agent-specific integration is required.

Open `weavemap/index.html` in a browser whenever you want to inspect the project.

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

- **Tasks** contain the goal, implementation spec, acceptance criteria, effort, priority, status, and dependencies.
- **Dependencies** are the structural source of truth.
- **Waves** are calculated dependency depths, not dates or weeks.
- **Ready frontier** is the set of work that can execute now.
- **Recommended next** prefers active work, then priority, downstream impact, and lower effort.
- **Requirements** record what the project must achieve.
- **Decisions** preserve important project choices and why they were made.

The execution map is derived automatically. The AI should not manually assign wave numbers.

## Philosophy

WeaveMap does not try to be Jira or Notion. The AI is the project manager; the human interface is for observability and intervention.

The repo is intentionally small so the whole tool can be copied into another project and used immediately.
