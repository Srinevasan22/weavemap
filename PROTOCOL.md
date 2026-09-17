# WeaveMap protocol

**Runtime version:** `1.0.0`  
**Current state schema:** `4`

WeaveMap is project management for AI agents, with a lightweight human observer UI.

This protocol is agent-agnostic. Any coding agent that can read and edit repository files can use it.

## Embedded location

WeaveMap lives inside the host repository as `weavemap/`.

When asked to initialize or use WeaveMap:

1. Read `weavemap/PROTOCOL.md` completely.
2. Inspect the host project outside `weavemap/`.
3. Read and maintain `weavemap/state.js` as canonical project-management state.
4. Record your agent/model identity when reliably known.
5. Treat the repository, not chat history, as the durable source of truth.

Normally edit only `weavemap/state.js`. Do not modify runtime files unless the user is explicitly developing or updating WeaveMap.

Keep `state.js` data-only: JSON-compatible literals wrapped in `window.WEAVEMAP = ...`. Do not add functions, imports, computed properties, runtime expressions, or helper variables.

## Runtime version and safe updates

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

Never replace an existing project's `state.js` with the blank source template during an update.

Safe update procedure:

1. Read and temporarily back up the current `state.js`.
2. Replace only the four runtime files.
3. Read the newly installed protocol.
4. Compare the project `schemaVersion` with the runtime schema.
5. Migrate the existing state in place only if required, preserving all project knowledge.
6. Validate the observer.
7. Delete the backup only after validation succeeds.
8. Do not modify host application code as part of a WeaveMap runtime update unless separately requested.

Runtime `v1.0.0` remains compatible with state schema `v4`; all new task fields are optional.

## Agent and model identity

Ensure `agents` records each unique agent/model pair that actually worked on the project:

```js
agents: [
  { name: "Codex", model: "GPT-5.6 Sol" },
  { name: "Claude Code", model: null }
]
```

Rules:

- Record the actual coding environment/agent.
- Record the exact model only when reliably available from system/environment context.
- Never infer or guess a model from provider or agent name.
- Use `null` when the exact model is unknown.
- Do not duplicate an identical name/model pair.
- Do not add timestamps or token counts unless the schema is explicitly extended later.

## Initialization mode

Set `project.entryMode` automatically from repository evidence:

- `"new"` when the project is effectively starting from scratch.
- `"adopted"` when meaningful code, tests, documentation, infrastructure, deployment configuration, or other project work already exists.

Do not ask when the repository makes this clear.

## Adopting an existing project

For adopted projects, reconstruct the present state rather than inventing project history.

Use:

```js
adoption: {
  baselineSummary: "Concise description of the state when WeaveMap joined.",
  established: [
    { text: "Capability established by evidence.", evidence: ["relative/path.ext"] }
  ],
  gaps: [
    {
      text: "Important missing or incomplete area.",
      evidence: ["relative/path.ext"],
      taskIds: ["T-004"],
      disposition: "tracked"
    }
  ],
  uncertainties: [
    { text: "Something not established confidently.", evidence: [] }
  ]
}
```

Adoption rules:

- Put only evidence-backed or explicitly user-stated capabilities in `established`.
- Prefer 1-3 high-value repository-relative evidence paths, not exhaustive lists.
- Put ambiguous/conflicting findings in `uncertainties`; do not guess.
- Do not manufacture historical completed tasks for existing features.
- Existing capabilities belong in the adoption baseline.
- Tasks represent remaining, active, incomplete, corrective, migration, test, cleanup, release, or roadmap work from the adoption point forward.
- Every gap must be `tracked`, `deferred`, or `accepted`.
- `tracked` gaps must reference real task IDs.
- Progress after adoption measures tracked work since the baseline, not the entire historical project.

## First initialization

If `initialized: false`:

1. Inspect the host project and user goal.
2. Set entry mode.
3. Set project name, summary, and current phase.
4. Record agent/model identity.
5. Build the adoption baseline when applicable.
6. Define only real workstreams.
7. Add explicit requirements with provenance.
8. Add actual decisions with provenance.
9. Decompose actionable remaining work into tasks.
10. Give each task an `origin` when its source is known.
11. Link tasks to requirements with `requirementIds` when they materially deliver those requirements.
12. Add only true hard dependencies.
13. Run the dependency sanity pass.
14. Review active requirement coverage and resolve obvious planning omissions.
15. Validate the DAG and state.
16. Set `initialized: true` before implementation.

## Task schema

Core task fields:

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
  spec: "Enough detail for another agent to continue without the original chat.",
  acceptance: ["Observable completion condition"],
  notes: []
}
```

Allowed statuses: `todo`, `active`, `blocked`, `done`, `skipped`.

Priority: `P1` highest through `P5` lowest.

Effort: relative AI work estimate `1` through `5`. Effort `5` should usually be decomposed.

### Optional coordination and provenance fields

Use only when they add real value:

```js
origin: "repo",
requirementIds: ["R-002", "R-006"],
affectedPaths: ["scanner_v2/test_samples/**"],
verification: {
  command: "py scanner_v2/test_regression.py"
},
humanApproval: {
  required: true,
  status: "pending"
},
completion: {
  by: "Antigravity",
  commit: "dbf2d95",
  verification: {
    command: "py scanner_v2/test_regression.py",
    result: "passed"
  }
}
```

All of these remain optional and schema-v4 compatible.

## Task origin

Task `origin` uses the same vocabulary as requirements and decisions:

- `user` — explicitly requested by the user;
- `repo` — discovered from code, tests, documentation, TODOs, failures, or other repository evidence;
- `agent` — proposed by an AI during planning or implementation.

Rules:

- Do not guess origin when it is unclear; omit it rather than inventing provenance.
- `origin: "agent"` means the task is AI-proposed. It does not automatically make material product scope a user commitment.
- If the user explicitly adopts an agent proposal, update provenance where appropriate.
- Task origin is informational; priority, dependencies, approvals, and acceptance criteria still control execution.

## Requirement coverage

Tasks may link to the requirements they materially deliver:

```js
requirementIds: ["R-002", "R-006"]
```

Rules:

- Reference only real requirement IDs.
- Link a task only when completing that task materially contributes to satisfying the requirement.
- Multiple tasks may cover one requirement, and one task may cover multiple requirements.
- Do not create artificial tasks merely to make every requirement appear covered.
- Requirements already satisfied by the adoption baseline should normally be marked `satisfied`, not left `active` solely to create task coverage.
- Before finalizing or materially replanning the graph, review **active** requirements that have no non-skipped task coverage.
- An uncovered active requirement is a planning signal, not automatically an error: resolve it by adding legitimate work, marking the requirement satisfied/dropped when justified, or preserving a clear reason for intentional non-coverage.

The observer derives coverage automatically from `requirementIds` and highlights uncovered active requirements.

## Task decomposition quality

A task should represent one coherent, verifiable outcome.

Split a task when:

- it contains multiple independently testable outcomes;
- one part can be completed while another remains unfinished;
- different parts affect substantially different workstreams or file areas;
- the task would need unrelated acceptance criteria;
- a future handoff would be clearer as separate tasks.

Do not keep a bundled task merely because its aggregate effort is below 5.

## Dependency semantics and sanity pass

`dependsOn` is a hard execution dependency.

Add task A to task B's `dependsOn` only when B cannot reasonably be executed or verified before A completes.

Do not encode preference, cleanliness, convenience, or roadmap order as a hard dependency.

After creating or materially changing the graph, review every dependency and ask:

> Would it still be valid and useful to execute the downstream task now if this upstream task were unfinished?

If yes, remove the dependency.

This dependency sanity pass is mandatory after first planning and after major replanning.

## Waiting vs blocked

These are different concepts:

- **Waiting** is derived automatically for a `todo` task with unfinished hard dependencies. It is normal sequencing.
- **Blocked** is explicit `status: "blocked"` and means a real obstacle prevents work independently of normal dependency ordering.

Do not mark a task blocked merely because a dependency is unfinished.

Use `blocked` for genuine obstacles such as missing credentials, unavailable hardware, unresolved external access, a required external decision, or another condition not already represented by task dependencies.

When setting blocked, preserve a concise reason in `notes`.

## Human approval gates

Use a dedicated gate when downstream work must not be treated as authorized until the human explicitly approves it:

```js
humanApproval: {
  required: true,
  status: "pending"
}
```

Allowed approval statuses: `pending`, `approved`, `rejected`.

Rules:

- Prefer a small dedicated approval task over hiding approval semantics inside a large implementation task.
- An AI must never change `pending` to `approved` or `rejected` based on assumption.
- An agent may persist approval/rejection when the user explicitly states that decision in the current interaction.
- A pending approval gate appears under **Needs human** and is not part of the AI Ready Frontier once its dependencies are satisfied.
- Downstream production tasks may depend on the approval gate.
- If approval is rejected, preserve the reason in task notes and revise the plan before requesting approval again.
- The observer can record human approval directly into the latest state file using merge-safe writes.

Typical uses: art direction, product scope, destructive migrations, publishing, release approval, irreversible external actions, or other explicit user decisions.

## Persistent task handoff notes

Every task must have `notes: []`.

Before starting or resuming a task, read its notes completely.

Use notes for concise context that prevents rediscovery:

- partial findings;
- files and commands already checked;
- useful test results;
- failed approaches;
- user clarifications;
- environment caveats;
- blockers and unresolved questions;
- next-pass handoff guidance.

Human-written notes are prefixed `Human:` and represent explicit user context/instructions unless superseded later.

Keep notes short and actionable. Do not paste chat transcripts or duplicate the stable task spec.

## Expected edit scope and parallel-agent coordination

`affectedPaths` is advisory coordination metadata for agents and subagents.

Use it when a task has a reasonably predictable edit surface:

```js
affectedPaths: [
  "frontend/lib/screens/session/**",
  "frontend/test/session/**"
]
```

Rules:

- It is not a file lock and does not prohibit necessary adjacent changes.
- Keep paths compact; do not list every file when one directory/glob communicates the same information.
- Before parallel work, compare affected paths for likely overlap.
- If two ready/active tasks have strongly overlapping edit scopes, treat that as a **coordination warning**, not an automatic blocker.
- Prefer assigning overlapping work sequentially or coordinating ownership explicitly when simultaneous edits would be unsafe.
- If implementation legitimately expands beyond the expected scope, update `affectedPaths` when that information will help the next agent.

The observer derives potential collisions from ready/active task path overlap and surfaces them without preventing execution.

## Verification commands

Use an optional verification command when the repository already establishes a clear way to prove task completion:

```js
verification: {
  command: "npm test -- session-service"
}
```

Rules:

- Do not invent a command merely to populate the field.
- Prefer existing tests, linters, build commands, validation scripts, or documented checks.
- Treat the command as an AI instruction; the browser observer does not execute shell commands.
- Before setting `done`, run the command when it is safe and available.
- If it cannot be run, do not falsely record it as successful; note why and use other acceptance evidence.
- A failing verification command normally means the task is not done unless the failure is demonstrably unrelated and recorded.

## Verification result and completion provenance

New completions should use a structured verification result:

```js
completion: {
  by: "Codex",
  commit: "dbf2d95",
  verification: {
    command: "npm test -- session-service",
    result: "passed",
    note: "Optional concise context"
  }
}
```

Allowed `completion.verification.result` values:

- `passed` — the recorded verification completed successfully;
- `failed` — verification failed; a task must not be `done` with this result;
- `not-run` — verification was not executed;
- `human-override` — a human explicitly marked the task done without claiming automated verification;
- `not-applicable` — verification is not relevant, such as an intentionally skipped task.

Rules:

- `by` identifies the agent or human that closed the task.
- `commit` is the relevant commit SHA only when a meaningful commit exists and is known.
- `command` records what actually ran, not merely the planned command.
- Never invent a commit SHA or verification result.
- If `verification.command` is configured and passes, prefer recording the same command with `result: "passed"`.
- If a task is done without running the configured command, use `not-run` only when completion is still justified by other evidence and explain that briefly in `note` or task notes.
- Do not mark a task `done` with `result: "failed"`.
- Human observer completion uses `human-override` and must not be treated as proof that automated verification ran.
- Reopening a task removes stale completion metadata.
- Dates are intentionally omitted; time is not a WeaveMap planning axis.

Legacy v0.9 string-form `completion.verification` remains readable, but agents should write the structured form for new completions.

## Requirements and provisional scope

Requirement object:

```js
{
  id: "R-001",
  text: "Users can sign in with email and password.",
  status: "active",
  origin: "repo",
  evidence: ["docs/auth.md"]
}
```

Allowed origins:

- `user` — explicitly stated by the user;
- `repo` — established by repository code/tests/docs/config/history;
- `agent` — proposed or inferred by AI and not yet established by the user or repository.

**Agent-origin requirements and scope are proposals, not commitments.**

An agent-origin planning envelope such as "5 regions / ~30 areas" must not silently become committed production scope or automatically generate a large downstream production plan as if approved.

When material proposed scope requires commitment, create an explicit human approval gate. Once the user approves, update requirement/decision provenance appropriately rather than continuing to present it as an unapproved agent proposal.

Allowed requirement statuses: `active`, `satisfied`, `dropped`.

## Decisions

Decision object:

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

Allowed statuses: `active`, `superseded`.

Use the same provenance values as requirements. Never silently rewrite a historical decision; append a superseding decision and mark the previous one superseded.

## Execution rules

Before substantial work:

1. Read `state.js`.
2. Read all `active` tasks and the Ready Frontier.
3. Review uncovered active requirements when planning context has materially changed.
4. Continue appropriate active work first.
5. Otherwise choose a ready task by priority, downstream impact, then lower effort.
6. Do not choose a pending human-approval gate as AI execution work.
7. Read the selected task's notes.
8. Review task origin, `requirementIds`, and `affectedPaths` when present.
9. Check ready/active path-overlap warnings before starting parallel work.
10. Set the selected task `active` before substantial implementation.

During work:

- Keep `spec` stable enough for another agent to continue.
- Update handoff notes when new information would save future rediscovery.
- Create tasks for newly discovered required work rather than leaving orphan TODOs in chat.
- Give new tasks an origin when known.
- Link new tasks to requirements when they materially cover them.
- Connect only true hard dependencies.
- Update adoption gap references when appropriate.
- If multiple agents work in parallel, compare `affectedPaths` for likely conflicts.

When finishing:

1. Verify every acceptance criterion.
2. Run `verification.command` when present, safe, and available.
3. Record the actual structured verification result in `completion.verification` when closing the task.
4. Add reliable `completion.by` and commit provenance when known.
5. Remove or revise stale notes while preserving useful maintenance/handoff information.
6. Set the task `done` only after verification is sufficient.
7. Update requirement statuses when completion actually satisfies them; do not mark requirements satisfied merely because a linked task exists.
8. Update adoption gap disposition/coverage if needed.
9. Re-read the graph before selecting the next task.

## Human observer controls

The observer can merge-safe edits into the latest `state.js` for:

- human handoff notes;
- priority changes;
- human approval/rejection;
- mark done as human override;
- skip;
- block with a reason;
- reopen.

These controls do not remove the AI's responsibility to read the updated state before continuing.

Human `Mark done` is explicitly recorded as `completion.verification.result: "human-override"`. It must not be interpreted as proof that a configured automated verification command ran successfully.

## Observer search and derived signals

The observer provides task search across IDs, titles, specs, notes, workstreams, paths, origins, and linked requirement IDs.

The following are derived UI signals and should not be manually stored as task fields:

- dependency wave;
- Ready / Waiting / Needs human state;
- active requirement coverage;
- potential edit-scope collisions;
- search results;
- recommended next task.

## State validation expectations

At minimum ensure:

- state schema matches the runtime;
- task/requirement/decision IDs are unique;
- task statuses, priorities, and effort values are valid;
- every task has string-array `notes`;
- dependencies reference real IDs and the DAG is acyclic;
- requirement/decision origins are valid;
- optional task origin is `user`, `repo`, or `agent`;
- optional `requirementIds` is a string array containing real requirement IDs;
- adoption gaps have valid dispositions and task references;
- optional `affectedPaths` is a string array;
- optional verification command is a non-empty string;
- optional completion metadata has valid fields;
- structured completion verification uses a valid result value;
- a done task does not carry `completion.verification.result: "failed"`;
- optional human approval has `required: true` and a valid status.

The observer performs defensive validation, but agents should avoid writing invalid state in the first place.

## Human authority

The user remains authoritative. Explicit user instructions may reprioritize, skip, block, approve, reject, reopen, redefine, add, remove, defer, accept, or commit work.

Persist those decisions in `state.js` so the repository reflects them instead of relying on chat history.

## Common-agent instruction

The same instruction works across agents:

> Read `weavemap/PROTOCOL.md` and use WeaveMap to manage this project as you work.

Do not create agent-specific copies of this protocol unless the host project explicitly requires one.
