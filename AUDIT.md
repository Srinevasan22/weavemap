# WeaveMap consistency audit

Completed September 27, 2026. Runtime 1.2.1; durable state schema remains 4.

## Fixed

| Finding | Result |
| --- | --- |
| The manifest lacked portable plugin metadata; the skill referenced absent resources and assumed Antigravity. | Agent Plugins 1.0 manifest, GPT/Codex workflow, full runtime resource bundle, reproducible package with an explicit file allowlist. |
| The advertised live HUD was a frozen generated snapshot. | Optional localhost server refreshes state and saves edits; standalone snapshots remain available and are documented accurately. |
| Duplicate refresh functions prevented task changes from refreshing HUD queues. | One refresh path updates the observer and HUD together. |
| Active tasks appeared ready, rejected gates became runnable, and gates appeared before dependencies finished. | Matching derived categories for active work, ready work, dependency waiting and unapproved gates; full-view ready list excludes active tasks. |
| Dependency depths and validation were computed only at page startup; workstream count never updated. | Recompute on refresh, update workstream count, and preserve selected workstream filters during live updates. |
| HUD text and verification commands were interpolated into HTML and inline JavaScript; script-closing text could break bundles. | Escaped text, command data attributes, safely serialized embedded state and replacement callbacks. |
| Browser and command-line validation disagreed; Node and PowerShell implementations drifted. | Shared schema validator and one generator, with a PowerShell wrapper. Windows now requires Node.js. |
| State files could execute arbitrary expressions when parsed. | Data-only literal parser shared by file editing and command-line tools. |
| Cancelling approval/skip prompts still changed tasks; reopened or blocked tasks retained completion metadata. | Cancellation returns without saving; unresolved tasks clear obsolete completion evidence. |
| Live edits could overwrite state observed before another writer changed it. | Revision checks, gate checks against the latest state, temporary-file replacement, and clear conflict messages. |

## Validation

- Six automated regression tests pass: parsing; invalid state/DAG metadata; task categories; mutation rules; standalone bundle safety; live HTTP reads, saves, external changes and stale-write rejection.
- The repository's existing 15 tasks validate, including five resolved tasks. Its state.js is unchanged.
- The PowerShell wrapper passes the same validation.
- Browser checks used synthetic data: saving a note, changing priority, completing a task, releasing its dependency, and switching between sidebar and full canvas were observed. No browser console errors were returned during inspection.
- The plugin archive excludes actual project state, dependencies, Git metadata and browser test outputs.

## Limits and remaining considerations

- This plugin requires repository file access and Node.js 18 or newer. It is not a remote GPT Action or hosted MCP application.
- Offline snapshots require regeneration. Downloaded edits must be manually installed when direct browser file writing is unavailable.
- Local revision checks are optimistic concurrency control, not a cross-process lock. An external writer can still race during the final check/rename interval.
- The validator checks structure, references and cycles. It does not prove that task evidence is truthful or that a claimed test passed. Existing state includes platform capability claims that should be reviewed against implementation evidence separately; this audit did not rewrite project history.
- Fullscreen and clipboard behavior depend on the browser/IDE sandbox. Every such host was not tested.
- Automatic approval review blocked browser access to real repository state because of possible exposure through the connector; browser verification therefore used a separate synthetic fixture.
