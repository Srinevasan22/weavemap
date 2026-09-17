window.WEAVEMAP = {
  "schemaVersion": 4,
  "initialized": true,
  "project": {
    "name": "AetherFlow",
    "summary": "High-throughput real-time stream ingestion and semantic event routing engine for autonomous edge agents.",
    "phase": "Active Development",
    "entryMode": "adopted"
  },
  "adoption": {
    "baselineSummary": "AetherFlow is an adopted Rust and TypeScript event pipeline with RocksDB persistence, WebSocket streaming, and sub-millisecond pub/sub topology.",
    "established": [
      {
        "text": "Sub-millisecond lock-free ring buffer queue for high-concurrency event ingestion.",
        "evidence": [
          "crates/core/src/ring.rs",
          "benches/throughput.rs"
        ]
      },
      {
        "text": "Declarative JSON schema filter engine compiled to native SIMD instructions.",
        "evidence": [
          "crates/simd-filter/src/lib.rs",
          "tests/filter_test.rs"
        ]
      },
      {
        "text": "WebSocket protocol server with credit-based flow control and heartbeat monitoring.",
        "evidence": [
          "src/server/ws.ts",
          "src/server/backpressure.ts"
        ]
      }
    ],
    "gaps": [
      {
        "text": "Telemetry metrics fail to flush cleanly under abrupt worker thread shutdown.",
        "evidence": [
          "crates/core/src/metrics.rs"
        ],
        "taskIds": [
          "T-004"
        ],
        "disposition": "tracked"
      },
      {
        "text": "Cluster mesh gossip protocol lacks automatic peer discovery in multi-region deployments.",
        "evidence": [
          "crates/cluster/src/gossip.rs"
        ],
        "taskIds": [],
        "disposition": "deferred"
      },
      {
        "text": "Windows named pipe transport accepted as unsupported for initial POSIX-only release.",
        "evidence": [
          "docs/rfcs/003-transports.md"
        ],
        "taskIds": [],
        "disposition": "accepted"
      }
    ],
    "uncertainties": [
      {
        "text": "Maximum sustainable memory consumption with 100k concurrent WebSocket connections on single node.",
        "evidence": [
          "benches/load_test.rs"
        ]
      },
      {
        "text": "Egress serialization overhead when streaming binary Arrow IPC batches vs JSON payloads.",
        "evidence": []
      }
    ]
  },
  "agents": [
    {
      "name": "Antigravity",
      "model": "Gemini 3.8 Flash"
    },
    {
      "name": "Claude Code",
      "model": "Claude 3.7 Sonnet"
    },
    {
      "name": "Cursor",
      "model": "Claude 3.5 Sonnet"
    }
  ],
  "requirements": [
    {
      "id": "R-001",
      "text": "Lock-free event ingestion maintaining sub-100 microsecond p99 latency.",
      "status": "satisfied",
      "origin": "repo",
      "evidence": [
        "benches/throughput.rs"
      ]
    },
    {
      "id": "R-002",
      "text": "Graceful shutdown draining active in-flight worker batches with zero data loss.",
      "status": "active",
      "origin": "user",
      "evidence": [
        "crates/core/src/metrics.rs"
      ]
    },
    {
      "id": "R-003",
      "text": "Explicit human approval gate before pushing non-reversible schema migrations to production.",
      "status": "active",
      "origin": "user",
      "evidence": [
        "docs/DEPLOYMENT.md"
      ]
    },
    {
      "id": "R-004",
      "text": "Dynamic worker thread pool autoscaling based on buffer saturation telemetry.",
      "status": "active",
      "origin": "agent",
      "evidence": [
        "src/scaler/worker.ts"
      ]
    },
    {
      "id": "R-005",
      "text": "Legacy XML payload transformation gateway.",
      "status": "dropped",
      "origin": "repo",
      "evidence": [
        "docs/DEPRECATED.md"
      ]
    }
  ],
  "decisions": [
    {
      "id": "D-001",
      "title": "Adopt SIMD-accelerated JSON filtering instead of V8 isolate evaluation",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "crates/simd-filter/src/lib.rs"
      ],
      "context": "JavaScript V8 sandbox evaluation incurred 1.2ms latency overhead per packet, violating throughput SLAs.",
      "implications": "Filters must be statically compiled rather than arbitrary JS scripts."
    },
    {
      "id": "D-002",
      "title": "Use temporary in-memory SQLite for ephemeral worker state",
      "status": "superseded",
      "supersedes": null,
      "origin": "agent",
      "evidence": [
        "crates/core/src/state.rs"
      ],
      "context": "Initial prototype used SQLite in WAL mode for worker checkpointing.",
      "implications": "Lock contention degraded write performance beyond 8 concurrent threads."
    },
    {
      "id": "D-003",
      "title": "Replace SQLite with lock-free RocksDB column families",
      "status": "active",
      "supersedes": "D-002",
      "origin": "user",
      "evidence": [
        "crates/core/src/storage.rs"
      ],
      "context": "RocksDB provides log-structured merge trees tailored for high-write telemetry.",
      "implications": "Requires C++ toolchain to compile RocksDB native bindings."
    }
  ],
  "tasks": [
    {
      "id": "T-001",
      "title": "Benchmark SIMD parser throughput against 10GB telemetry dataset",
      "workstream": "Core Ingestion",
      "phase": "Validation",
      "status": "done",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [],
      "requirementIds": [
        "R-001"
      ],
      "origin": "repo",
      "affectedPaths": [
        "crates/simd-filter/**"
      ],
      "goal": "Verify p99 latency stays under 100 microseconds at 2M events/second.",
      "spec": "Run criterion benchmarks on release build across diverse JSON payloads.",
      "acceptance": [
        "p99 latency reported below 85 microseconds",
        "zero memory leaks detected under valgrind"
      ],
      "verification": {
        "command": "cargo bench -p simd-filter"
      },
      "completion": {
        "by": "Claude Code",
        "commit": "a4f89d1",
        "verification": {
          "command": "cargo bench -p simd-filter",
          "result": "passed"
        }
      },
      "notes": [
        "Achieved 62us p99 on 16-core runner with AVX-512 enabled."
      ]
    },
    {
      "id": "T-002",
      "title": "Implement WebSocket backpressure flow control tokens",
      "workstream": "Streaming Transport",
      "phase": "Foundation",
      "status": "done",
      "priority": "P2",
      "effort": 2,
      "dependsOn": [],
      "origin": "repo",
      "affectedPaths": [
        "src/server/**"
      ],
      "goal": "Prevent client memory exhaustion when consuming high-velocity feeds.",
      "spec": "Credit-based window flow control implemented on client session socket.",
      "acceptance": [
        "Server pauses buffer delivery when client credits reach 0",
        "Client replenishes credits with ACK messages"
      ],
      "verification": {
        "command": "npm test -- ws-backpressure.test.ts"
      },
      "completion": {
        "by": "Antigravity",
        "commit": "7b13e9a",
        "verification": {
          "command": "npm test -- ws-backpressure.test.ts",
          "result": "passed"
        }
      },
      "notes": [
        "Verified with 10,000 simulated slow clients without OOM."
      ]
    },
    {
      "id": "T-003",
      "title": "Construct legacy Protobuf v2 bridge connector",
      "workstream": "Streaming Transport",
      "phase": "Foundation",
      "status": "skipped",
      "priority": "P4",
      "effort": 1,
      "dependsOn": [],
      "origin": "repo",
      "affectedPaths": [
        "crates/legacy-bridge/**"
      ],
      "goal": "Provide backward compatibility with legacy upstream sensors.",
      "spec": "Transcode Protobuf v2 binary frames into internal ring buffer format.",
      "acceptance": [
        "Legacy sensors connect without error"
      ],
      "notes": [
        "Skipped by user: all legacy sensors upgraded to direct Arrow flight."
      ]
    },
    {
      "id": "T-004",
      "title": "Flush telemetry metrics on abrupt worker shutdown",
      "workstream": "Core Ingestion",
      "phase": "Active Development",
      "status": "active",
      "priority": "P1",
      "effort": 3,
      "dependsOn": [
        "T-001"
      ],
      "requirementIds": [
        "R-002"
      ],
      "origin": "repo",
      "affectedPaths": [
        "crates/core/src/**",
        "src/types/**"
      ],
      "goal": "Resolve adoption baseline gap where metrics buffer loses last 2 seconds on SIGTERM.",
      "spec": "Install crossbeam channel signal handler to drain telemetry queue before dropping worker threads.",
      "acceptance": [
        "All staged events flushed to RocksDB upon SIGINT/SIGTERM",
        "Process exits cleanly with code 0 within 500ms shutdown timeout"
      ],
      "verification": {
        "command": "cargo test -p aetherflow-core --test shutdown_drain"
      },
      "notes": [
        "Signal hook registered. Finalizing thread join barrier."
      ]
    },
    {
      "id": "T-005",
      "title": "Implement dynamic worker thread autoscaler",
      "workstream": "Core Ingestion",
      "phase": "Active Development",
      "status": "todo",
      "priority": "P2",
      "effort": 2,
      "dependsOn": [
        "T-001"
      ],
      "requirementIds": [
        "R-004"
      ],
      "origin": "agent",
      "affectedPaths": [
        "crates/core/src/**",
        "src/scaler/**"
      ],
      "goal": "Scale thread pool from 4 to 32 workers based on ring buffer saturation.",
      "spec": "Monitor queue depth every 50ms. Trigger worker expansion when capacity exceeds 75%.",
      "acceptance": [
        "Worker count scales dynamically under synthetic traffic spikes",
        "Idle workers gracefully terminate after 5s cool-down"
      ],
      "verification": {
        "command": "npm run test:scaler"
      },
      "notes": [
        "Ready on frontier. Advisory coordination overlap on crates/core/src/** with T-004."
      ]
    },
    {
      "id": "T-006",
      "title": "Approve production schema migration and indexing strategy",
      "workstream": "Security & Operations",
      "phase": "Deployment",
      "status": "todo",
      "priority": "P1",
      "effort": 1,
      "dependsOn": [
        "T-001"
      ],
      "requirementIds": [
        "R-003"
      ],
      "origin": "user",
      "affectedPaths": [
        "migrations/2026_09_production_tables.sql"
      ],
      "goal": "Explicit gate requiring human review before running non-reversible database migrations.",
      "spec": "Verify table indexing parameters, replica read topology, and roll-back script.",
      "acceptance": [
        "Human verifies and approves migration plan in observer"
      ],
      "humanApproval": {
        "required": true,
        "status": "pending"
      },
      "notes": [
        "Migration dry-run succeeded on staging replica. Awaiting user authorization."
      ]
    },
    {
      "id": "T-007",
      "title": "Configure enterprise OIDC SSO integration",
      "workstream": "Security & Operations",
      "phase": "Security",
      "status": "blocked",
      "priority": "P2",
      "effort": 2,
      "dependsOn": [],
      "origin": "user",
      "affectedPaths": [
        "src/auth/oidc.ts"
      ],
      "goal": "Authenticate enterprise dashboard users via Okta/Azure AD.",
      "spec": "Wire up OpenID Connect authorization code flow with PKCE.",
      "acceptance": [
        "Successful login redirect and token verification"
      ],
      "notes": [
        "BLOCKED: Awaiting Okta client ID and tenant secrets from customer SecOps team."
      ]
    },
    {
      "id": "T-008",
      "title": "Deploy canary release to multi-region edge nodes",
      "workstream": "Security & Operations",
      "phase": "Deployment",
      "status": "todo",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [
        "T-004",
        "T-006"
      ],
      "origin": "user",
      "affectedPaths": [
        "infra/terraform/**"
      ],
      "goal": "Roll out updated ingestion binaries to 5% of edge traffic.",
      "spec": "Execute terraform canary rollout script following approval and worker drain verification.",
      "acceptance": [
        "Canary healthy with error rate < 0.001% over 30 minutes"
      ],
      "verification": {
        "command": "./scripts/verify-canary.sh"
      },
      "notes": [
        "Waiting normally on T-004 (metrics drain) and T-006 (human approval gate)."
      ]
    },
    {
      "id": "T-009",
      "title": "Mount real-time throughput metrics into observer dashboard",
      "workstream": "Frontend & UI",
      "phase": "Observability",
      "status": "todo",
      "priority": "P3",
      "effort": 2,
      "dependsOn": [
        "T-005"
      ],
      "origin": "agent",
      "affectedPaths": [
        "src/dashboard/**"
      ],
      "goal": "Visualize active thread count and buffer saturation in real-time chart.",
      "spec": "Subscribe to telemetry WebSocket topic and render SVG sparkline in dashboard.",
      "acceptance": [
        "Throughput sparkline updates smoothly at 60fps without DOM thrashing"
      ],
      "notes": [
        "Waiting on autoscaler telemetry implementation (T-005)."
      ]
    }
  ]
};
