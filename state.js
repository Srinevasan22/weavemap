window.WEAVEMAP = {
  "schemaVersion": 4,
  "initialized": true,
  "project": {
    "name": "WeaveMap Platform",
    "summary": "High-performance DAG workflow orchestration engine, state synchronizer, and live visual observer for collaborative multi-agent autonomous engineering teams and human supervisors.",
    "phase": "Engine v2 & Multi-Agent Orchestration",
    "entryMode": "adopted"
  },
  "adoption": {
    "baselineSummary": "WeaveMap adopted into the core WeaveMap platform monorepo following completion of baseline schema v4 specification, SVG canvas renderer, and side-pane HUD cockpit.",
    "established": [
      {
        "text": "Core DAG topology resolver with cycle detection, transitive reduction, and topological sorting.",
        "evidence": [
          "weavemap/app.js",
          "weavemap/PROTOCOL.md"
        ]
      },
      {
        "text": "Reactive SVG weave canvas with dynamic cubic bezier thread calculation, column virtualization, and zoom/pan matrix.",
        "evidence": [
          "weavemap/index.html",
          "weavemap/style.css"
        ]
      },
      {
        "text": "Multi-agent file locking and protocol handler enforcing Schema v4 conformance and human approval gates.",
        "evidence": [
          "weavemap/PROTOCOL.md",
          "weavemap/app.js"
        ]
      },
      {
        "text": "Real-time observer HUD with live frontier queue, waiting queue, approval gate alerts, and completed archive.",
        "evidence": [
          "weavemap/generate_hud.ps1",
          "weavemap/index.html",
          "weavemap/app.js"
        ]
      }
    ],
    "gaps": [
      {
        "text": "Persistent graph database migration pending human security sign-off.",
        "evidence": [
          "weavemap/PROTOCOL.md"
        ],
        "taskIds": [
          "T-013"
        ],
        "disposition": "tracked"
      },
      {
        "text": "Enterprise SAML SSO provider integration blocked on sandbox credentials.",
        "evidence": [
          "weavemap/PROTOCOL.md"
        ],
        "taskIds": [
          "T-015"
        ],
        "disposition": "tracked"
      }
    ],
    "uncertainties": []
  },
  "requirements": [
    {
      "id": "R-001",
      "text": "Deterministic DAG topology resolution with zero circular dependency tolerance.",
      "status": "satisfied",
      "origin": "repo",
      "evidence": [
        "weavemap/app.js"
      ]
    },
    {
      "id": "R-002",
      "text": "Zero-dependency pure HTML/CSS/SVG visual rendering readable by both browsers and headless agents.",
      "status": "active",
      "origin": "user",
      "evidence": [
        "weavemap/index.html"
      ]
    },
    {
      "id": "R-003",
      "text": "Strict Schema v4 compliance with full auditability of agent vs human modifications.",
      "status": "satisfied",
      "origin": "repo",
      "evidence": [
        "weavemap/PROTOCOL.md"
      ]
    },
    {
      "id": "R-004",
      "text": "Human approval gating mechanism for high-impact or destructive operations.",
      "status": "active",
      "origin": "user",
      "evidence": [
        "weavemap/app.js"
      ]
    },
    {
      "id": "R-005",
      "text": "Side-pane HUD view with real-time frontier, waiting queue, and chronological completion tracking.",
      "status": "satisfied",
      "origin": "user",
      "evidence": [
        "weavemap/generate_hud.ps1"
      ]
    }
  ],
  "decisions": [
    {
      "id": "D-001",
      "title": "Use Schema v4 with strict humanApproval and completion metadata",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "weavemap/PROTOCOL.md"
      ]
    }
  ],
  "tasks": [
    {
      "id": "T-001",
      "title": "Implement acyclic graph topological dependency sorter",
      "workstream": "Core DAG Engine",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "done",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [],
      "origin": "repo",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "weavemap/app.js"
      ],
      "goal": "Ensure deterministic topological task ordering and instant cycle detection across arbitrary graph depths.",
      "spec": "Implement Kahn's algorithm with depth-map calculation, cycle validation, and frontier classification.",
      "acceptance": [
        "Detects cycles and throws explicit descriptive errors",
        "Computes accurate topological depth for every node",
        "Resolves ready frontier nodes with zero unmet dependencies"
      ],
      "verification": {
        "command": "npm test"
      },
      "completedAt": "2026-09-19T10:15:00Z",
      "completion": {
        "by": "Antigravity",
        "at": "2026-09-19T10:15:00Z",
        "verification": {
          "command": "npm test",
          "result": "passed",
          "note": "Topological sort, cycle detection, and depth assignment unit tests passed cleanly."
        }
      },
      "notes": [
        "Implemented Kahn algorithm with O(V+E) performance; verified zero cycle leaks."
      ]
    },
    {
      "id": "T-002",
      "title": "Build SVG bezier strand connector layer for visual weave",
      "workstream": "Visual Observer",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "done",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [],
      "origin": "repo",
      "requirementIds": [
        "R-002"
      ],
      "affectedPaths": [
        "weavemap/index.html",
        "weavemap/style.css"
      ],
      "goal": "Render fluid, aesthetically pleasing cubic bezier curves connecting dependent tasks across workstream rows.",
      "spec": "Calculate dynamic SVG path control points between source output anchors and target input anchors, handling cross-row weaving.",
      "acceptance": [
        "Smooth cubic bezier curves connecting prerequisite and successor cards",
        "Adaptive stroke color based on dependency state (active, done, waiting)",
        "Zero visual clipping on window resize"
      ],
      "verification": {
        "command": "npm test"
      },
      "completedAt": "2026-09-19T11:30:00Z",
      "completion": {
        "by": "Antigravity",
        "at": "2026-09-19T11:30:00Z",
        "verification": {
          "command": "npm test",
          "result": "passed",
          "note": "Bezier path calculation and anchor snapping validated across layout variations."
        }
      },
      "notes": [
        "Integrated dynamic SVG path drawing with requestAnimationFrame throttling."
      ]
    },
    {
      "id": "T-003",
      "title": "Standardize Schema v4 state validation contract",
      "workstream": "Agent Protocol",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "done",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [],
      "origin": "repo",
      "requirementIds": [
        "R-003"
      ],
      "affectedPaths": [
        "weavemap/PROTOCOL.md",
        "weavemap/app.js"
      ],
      "goal": "Provide strict JSON schema validation for state.js to guarantee cross-agent compatibility.",
      "spec": "Define JSON schema for state v4 covering project, adoption, requirements, tasks, humanApproval, and completion metadata.",
      "acceptance": [
        "Rejects invalid task statuses, missing IDs, or malformed dependencies",
        "Validates optional completion and human approval fields",
        "Documents complete schema specification in PROTOCOL.md"
      ],
      "verification": {
        "command": "npm test"
      },
      "completedAt": "2026-09-19T12:20:00Z",
      "completion": {
        "by": "Antigravity",
        "at": "2026-09-19T12:20:00Z",
        "verification": {
          "command": "npm test",
          "result": "passed",
          "note": "Schema v4 validation suite passed with 28 positive and negative test cases."
        }
      },
      "notes": [
        "Schema v4 finalized in PROTOCOL.md with backward compatibility for optional metadata."
      ]
    },
    {
      "id": "T-004",
      "title": "Implement interactive side-pane HUD cockpit layout",
      "workstream": "HUD & Telemetry",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "done",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [
        "T-002"
      ],
      "origin": "user",
      "requirementIds": [
        "R-005"
      ],
      "affectedPaths": [
        "weavemap/generate_hud.ps1",
        "weavemap/index.html",
        "weavemap/app.js"
      ],
      "goal": "Provide a vertical sidebar HUD with metrics banner, collapsible categories, and embedded canvas viewer.",
      "spec": "Build responsive side-pane HUD featuring mode toggle (Sidebar HUD / Full Canvas), copy-command pills, and status chip tooltips.",
      "acceptance": [
        "Progress bar and stat chips display live metrics",
        "Sections render in order: Human Approval, Ready Frontier, Waiting, Completed, Canvas Viewer",
        "Supports 3-task preview with 'View all' expansion and inner scroll"
      ],
      "verification": {
        "command": "npm test"
      },
      "completedAt": "2026-09-19T13:40:00Z",
      "completion": {
        "by": "Antigravity",
        "at": "2026-09-19T13:40:00Z",
        "verification": {
          "command": "npm test",
          "result": "passed",
          "note": "HUD layout, toggle states, collapsible categories, and copy triggers verified."
        }
      },
      "notes": [
        "Sidebar HUD styled with native WeaveMap palette (#f7f7f5, #ffffff, #deded8)."
      ]
    },
    {
      "id": "T-005",
      "title": "Add atomic file locking for concurrent agent state mutations",
      "workstream": "Agent Protocol",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "done",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [
        "T-003"
      ],
      "origin": "user",
      "requirementIds": [
        "R-003"
      ],
      "affectedPaths": [
        "weavemap/PROTOCOL.md",
        "weavemap/app.js"
      ],
      "goal": "Prevent race conditions and state corruption when multiple autonomous agents update state.js simultaneously.",
      "spec": "Implement POSIX/Windows flock advisory locking with exponential backoff and stale lock eviction.",
      "acceptance": [
        "Concurrent lock attempts queue gracefully with timeout",
        "Auto-recovers from orphaned locks if process crashes",
        "Atomic write-and-replace semantics for state.js"
      ],
      "verification": {
        "command": "npm test"
      },
      "completedAt": "2026-09-19T14:15:00Z",
      "completion": {
        "by": "Antigravity",
        "at": "2026-09-19T14:15:00Z",
        "verification": {
          "command": "npm test",
          "result": "passed",
          "note": "Concurrency stress test completed with zero lock collisions or file corruptions."
        }
      },
      "notes": [
        "Atomic rename pattern verified across Windows, macOS, and Linux."
      ]
    },
    {
      "id": "T-006",
      "title": "Construct dynamic depth-aware thread routing engine",
      "workstream": "Visual Observer",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "active",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [
        "T-001"
      ],
      "origin": "repo",
      "requirementIds": [
        "R-002"
      ],
      "affectedPaths": [
        "weavemap/index.html",
        "weavemap/style.css"
      ],
      "goal": "Route multi-step dependency threads around intermediate cards to eliminate line crossings.",
      "spec": "Implement orthogonal and rounded edge bundling router that calculates obstacle bounding boxes and channels cables through grid alleys.",
      "acceptance": [
        "Threads do not overlap intermediate task cards",
        "Edge bundling groups parallel dependencies into unified channels",
        "Render time stays under 16ms for 100+ tasks"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Bounding box collision detection implemented; currently calibrating routing channel offsets."
      ]
    },
    {
      "id": "T-007",
      "title": "Implement WebSocket live-reload bridge for instant state updates",
      "workstream": "HUD & Telemetry",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [
        "T-004"
      ],
      "origin": "user",
      "requirementIds": [
        "R-005"
      ],
      "affectedPaths": [
        "weavemap/app.js",
        "weavemap/generate_hud.ps1"
      ],
      "goal": "Eliminate manual browser reloads by pushing state diffs over local WebSocket to update HUD and canvas instantly.",
      "spec": "Set up lightweight WebSocket server observing state.js file writes; broadcast state reload event to attached browser tabs.",
      "acceptance": [
        "UI refreshes within 100ms of state.js disk write",
        "Preserves scroll position and active card modal during hot-reload",
        "Graceful offline reconnect when agent restarts"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Ready on frontier. Depends on HUD layout baseline (T-004)."
      ]
    },
    {
      "id": "T-008",
      "title": "Add multi-agent identity tracking and provenance headers",
      "workstream": "Agent Protocol",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P2",
      "effort": 2,
      "dependsOn": [
        "T-005"
      ],
      "origin": "repo",
      "requirementIds": [
        "R-003"
      ],
      "affectedPaths": [
        "weavemap/PROTOCOL.md",
        "weavemap/app.js"
      ],
      "goal": "Record exact agent runtime, model name, and task attribution in state.js for collaborative multi-agent execution.",
      "spec": "Append mutating agent metadata to `agents` array and task `completion.by` attribute without duplicate entries.",
      "acceptance": [
        "Correctly attributes edits to Codex, Claude, Antigravity, or Human",
        "Never duplicates identical agent/model pairs",
        "Renders agent attribution badge in task modal header"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Ready on frontier. Protocol locking prerequisite (T-005) complete."
      ]
    },
    {
      "id": "T-009",
      "title": "Optimize canvas pan and zoom transform matrix performance",
      "workstream": "Visual Observer",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P2",
      "effort": 3,
      "dependsOn": [
        "T-002"
      ],
      "origin": "user",
      "requirementIds": [
        "R-002"
      ],
      "affectedPaths": [
        "weavemap/index.html",
        "weavemap/style.css"
      ],
      "goal": "Achieve buttery smooth 60fps pan and pinch-to-zoom across massive multi-wave task maps.",
      "spec": "Use CSS GPU transform3d matrices, will-change hints, and passive pointer event handlers for zoom-to-cursor behavior.",
      "acceptance": [
        "60fps frame rate during pan and zoom on 4K displays",
        "Zoom centers on cursor position rather than top-left corner",
        "Supports touch gestures on mobile/tablet viewports"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Ready on frontier. SVG strand layer (T-002) complete."
      ]
    },
    {
      "id": "T-010",
      "title": "Build distributed task work-stealing queue across agent workers",
      "workstream": "Core DAG Engine",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P1",
      "effort": 4,
      "dependsOn": [
        "T-006"
      ],
      "origin": "repo",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "weavemap/app.js"
      ],
      "goal": "Allow multiple autonomous coding subagents to claim frontier tasks without conflicting overlap.",
      "spec": "Implement distributed work-stealing queue where idle agents atomically claim lowest-effort frontier tasks from overloaded queues.",
      "acceptance": [
        "No two agents ever claim the same task simultaneously",
        "Automatically re-queues tasks if agent process heartbeat times out",
        "Fair prioritization balancing P1/P2 urgency and dependency depth"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Waiting on thread routing (T-006) to finalize task status signaling."
      ]
    },
    {
      "id": "T-011",
      "title": "Implement reactive dependency ripple re-evaluation",
      "workstream": "Core DAG Engine",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P2",
      "effort": 3,
      "dependsOn": [
        "T-010"
      ],
      "origin": "repo",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "weavemap/app.js"
      ],
      "goal": "Automatically trigger cascading frontier readiness recalculations whenever a task changes status to done or skipped.",
      "spec": "Listen to task resolution events and traverse forward dependency graph to awaken waiting downstream tasks into the frontier.",
      "acceptance": [
        "Downstream tasks immediately transition from waiting to ready upon predecessor completion",
        "Skipped predecessor tasks properly satisfy downstream unblock conditions",
        "Zero redundant full-graph recalculations"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Waiting on distributed worker scheduler (T-010)."
      ]
    },
    {
      "id": "T-012",
      "title": "Create custom canvas themes and high-contrast colorways",
      "workstream": "Visual Observer",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P3",
      "effort": 1,
      "dependsOn": [
        "T-009"
      ],
      "origin": "user",
      "requirementIds": [
        "R-002"
      ],
      "affectedPaths": [
        "weavemap/style.css"
      ],
      "goal": "Provide user-selectable themes including Dark Mode, Light Sand, High Contrast, and Tokyo Night.",
      "spec": "Implement CSS variable token sets and persistent theme picker toggle in observer toolbar.",
      "acceptance": [
        "Themes switch instantly with zero page flicker",
        "Meets WCAG AAA contrast ratios in high-contrast mode",
        "Persists user preference in localStorage"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Waiting on canvas matrix optimization (T-009)."
      ]
    },
    {
      "id": "T-013",
      "title": "Execute database schema migration for v5 persistent graph storage",
      "workstream": "Core DAG Engine",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [
        "T-005"
      ],
      "origin": "user",
      "requirementIds": [
        "R-004"
      ],
      "affectedPaths": [
        "weavemap/PROTOCOL.md",
        "weavemap/app.js"
      ],
      "goal": "Migrate persistent task storage from flat JSON files to embedded graph database for 100k+ node scales.",
      "spec": "Run forward schema migration creating indexed tables for nodes, edges, execution logs, and audit trails.",
      "acceptance": [
        "Complete data integrity with zero record loss from state.js",
        "Rollback migration script tested and verified",
        "Requires explicit human sign-off before execution"
      ],
      "verification": {
        "command": "npm run migrate:v5 -- --verify"
      },
      "humanApproval": {
        "required": true,
        "status": "pending",
        "prompt": "Requires human authorization to run destructive schema migration on persistent graph storage."
      },
      "notes": [
        "Gate pending: Destructive migration requires human review before applying."
      ]
    },
    {
      "id": "T-014",
      "title": "Publish WeaveMap v2.0 npm package and release binary",
      "workstream": "Governance & Security",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "todo",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [
        "T-007",
        "T-008"
      ],
      "origin": "user",
      "requirementIds": [
        "R-004"
      ],
      "affectedPaths": [
        "weavemap/PROTOCOL.md"
      ],
      "goal": "Publish official WeaveMap 2.0 release to npm and GitHub Releases with provenance signatures.",
      "spec": "Tag v2.0.0, build bundle assets, run release verification checks, and deploy to npm registry.",
      "acceptance": [
        "All CI test suites pass with 100% success",
        "Cryptographic SLSA provenance attestation generated",
        "Sign-off received from release engineering"
      ],
      "verification": {
        "command": "npm run verify:release"
      },
      "humanApproval": {
        "required": true,
        "status": "pending",
        "prompt": "Release gate: Human approval required before publishing v2.0.0 tag to public npm registry."
      },
      "notes": [
        "Gate pending: Final release gate for v2.0.0 distribution."
      ]
    },
    {
      "id": "T-015",
      "title": "Integrate enterprise SAML / OIDC single sign-on provider",
      "workstream": "Governance & Security",
      "phase": "Engine v2 & Multi-Agent Orchestration",
      "status": "blocked",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [],
      "origin": "user",
      "requirementIds": [
        "R-004"
      ],
      "affectedPaths": [
        "weavemap/app.js"
      ],
      "goal": "Support corporate Okta/Azure AD SSO authentication for observer cockpit access.",
      "spec": "Implement SAML 2.0 and OpenID Connect SP metadata negotiation, signature validation, and user role mapping.",
      "acceptance": [
        "Okta and Azure AD test assertions validate successfully",
        "Session tokens signed with rotating RSA keypair",
        "Graceful fallback to local observer mode"
      ],
      "verification": {
        "command": "npm test"
      },
      "notes": [
        "Blocked on Okta sandbox staging credentials and client secret provisioning from IT Security."
      ]
    }
  ],
  "agents": [
    {
      "name": "Antigravity",
      "model": null
    }
  ]
};
