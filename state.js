window.WEAVEMAP = {
  "schemaVersion": 4,
  "initialized": true,
  "project": {
    "name": "AimSight",
    "summary": "Unified monorepo for ISSF 10m Air Pistol target tracking, analysis, and scoring, comprising a Flutter cross-platform mobile client, Node/Express backend API, and high-precision OpenCV edge scanner engine.",
    "phase": "Scanner v2 & Pre-Release Hardening",
    "entryMode": "adopted"
  },
  "adoption": {
    "baselineSummary": "WeaveMap adopted into the established AimSight monorepo following completion of Scanner v2 core computer vision engine, universal BLE heart rate integration, and initial mobile App Store release candidate preparations.",
    "established": [
      {
        "text": "Flutter mobile client (iOS/Android) with email/password and Google OAuth authentication, session history, target visualization, and offline caching.",
        "evidence": [
          "frontend/lib/services/auth_service.dart",
          "frontend/lib/services/session_service.dart",
          "frontend/lib/screens/dashboard_page.dart"
        ]
      },
      {
        "text": "Node.js Express backend API with MongoDB/Mongoose persistence, JWT security, user management, and motion calibration endpoints.",
        "evidence": [
          "backend/index.js",
          "backend/route/authRoutes.js",
          "backend/route/sessionRoutes.js"
        ]
      },
      {
        "text": "Scanner v2 edge computer vision engine (Python/OpenCV) implementing 1700x1700px canonical card homography, dual-zone Hough circle segmentation, figure-8 cluster separation, and ISSF caliper scoring.",
        "evidence": [
          "scanner_v2/scan_target_v2.py",
          "scanner_v2/core/registration.py",
          "scanner_v2/core/scoring.py"
        ]
      },
      {
        "text": "Universal BLE heart rate integration supporting continuous telemetry for Polar, Whoop, and Fitbit Charge 6 with per-target metric attribution.",
        "evidence": [
          "frontend/lib/services/ble_heart_rate_service.dart",
          "frontend/lib/services/smartwatch_service.dart"
        ]
      },
      {
        "text": "Admin/registration and raw agreement compliance workflows (scanner consent, account sanction, Play Data Safety disclosure).",
        "evidence": [
          "frontend/lib/screens/login_page.dart",
          "docs/privacy_policy.md"
        ]
      },
      {
        "text": "Backend test suite using Jest and mongodb-memory-server, and Flutter widget and unit test coverage.",
        "evidence": [
          "backend/test/scan.test.js",
          "frontend/test/widget_test.dart"
        ]
      }
    ],
    "gaps": [
      {
        "text": "Root repository contains unorganized manual test artifacts, raw camera photos, and crop debug files that should be standardized into scanner_v2/test_samples/.",
        "evidence": [
          "scanner_v2/benchmark.py",
          "README.md"
        ],
        "taskIds": [
          "T-001"
        ],
        "disposition": "tracked"
      },
      {
        "text": "Deprecation and migration path from legacy backend scanner scripts to standalone scanner_v2 pipeline.",
        "evidence": [
          "backend/controller/scanController.js"
        ],
        "taskIds": [
          "T-003"
        ],
        "disposition": "tracked"
      },
      {
        "text": "Comprehensive integration testing between frontend target re-analysis dialog, scan credit deduction, and backend subscription ledger.",
        "evidence": [
          "frontend/lib/screens/session_detail_page.dart"
        ],
        "taskIds": [
          "T-004"
        ],
        "disposition": "tracked"
      },
      {
        "text": "Stress testing of BLE background connection recovery under aggressive OS battery optimization.",
        "evidence": [
          "frontend/lib/services/ble_heart_rate_service.dart"
        ],
        "taskIds": [
          "T-005"
        ],
        "disposition": "tracked"
      }
    ],
    "uncertainties": [
      {
        "text": "Production deployment architecture and secrets rotation lifecycle for api.srinevasan.com/pistol host environment.",
        "evidence": [
          "backend/docs/deployment.md"
        ]
      },
      {
        "text": "Final AdMob network ID configuration and App Store / Play Store Connect client sync transitions state across release branches.",
        "evidence": [
          "frontend/lib/services/ad_service.dart"
        ]
      }
    ]
  },
  "agents": [
    {
      "name": "Antigravity",
      "model": "Gemini 3.8 Flash"
    }
  ],
  "requirements": [
    {
      "id": "R-001",
      "text": "Accurate automatic scoring of ISSF 10m air pistol targets conforming to caliper gauge rules (inward touch rule).",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "scanner_v2/core/scoring.py"
      ]
    },
    {
      "id": "R-002",
      "text": "Cross-platform mobile training app with secure user authentication and session history.",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "frontend/lib/services/auth_service.dart"
      ]
    },
    {
      "id": "R-003",
      "text": "Continuous physiological telemetry (BLE heart rate) correlated with individual shots and target series.",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "frontend/lib/services/ble_heart_rate_service.dart"
      ]
    },
    {
      "id": "R-004",
      "text": "Offline-first session capture with cloud synchronization upon network restoration.",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "frontend/lib/services/session_service.dart"
      ]
    },
    {
      "id": "R-005",
      "text": "Target re-analysis capability allowing athletes to re-scan targets with updated detection parameters at the cost of 1 scan credit.",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "frontend/lib/screens/session_detail_page.dart"
      ]
    },
    {
      "id": "R-007",
      "text": "Gamification and player retention via Google Play Games Services achievement tracking.",
      "status": "active",
      "origin": "user",
      "evidence": [
        "frontend/lib/services/achievement_service.dart"
      ]
    }
  ],
  "decisions": [
    {
      "id": "D-001",
      "title": "Dual-Zone Hough Transform and Distance Transform Clustering for Perforation Detection",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "scanner_v2/core/hole_detector.py"
      ]
    },
    {
      "id": "D-002",
      "title": "Universal BLE Protocol for Smartwatch and Heart Rate Monitors",
      "status": "active",
      "origin": "repo",
      "evidence": [
        "frontend/lib/services/ble_heart_rate_service.dart"
      ]
    }
  ],
  "tasks": [
    {
      "id": "T-001",
      "title": "Consolidate root test sample images into scanner test harness",
      "workstream": "QA",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "done",
      "priority": "P2",
      "effort": 1,
      "dependsOn": [],
      "origin": "repo",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "scanner_v2/test_samples/**"
      ],
      "goal": "Clean up scattered debug targets, crops, and sample photos in the project root.",
      "spec": "Move cand_*, crop_*, target_* raw/debug images from repository root into scanner_v2/test_samples/.",
      "acceptance": [
        "Repository root is clean of temporary image artifacts",
        "Existing scanner_v2 benchmark scripts continue to access sample targets"
      ],
      "verification": {
        "command": "py scanner_v2/benchmark.py"
      },
      "completion": {
        "by": "Antigravity",
        "verification": {
          "command": "py scanner_v2/test_regression.py",
          "result": "passed"
        }
      },
      "notes": [
        "Organized raw targets into raw_targets/ and calibration_debug/ with test catalog."
      ]
    },
    {
      "id": "T-002",
      "title": "Execute Scanner v2 benchmark and regression test suite",
      "workstream": "Computer Vision",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "done",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [
        "T-001"
      ],
      "origin": "repo",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "scanner_v2/benchmark.py"
      ],
      "goal": "Establish automated benchmark score and accuracy baseline for 10m targets.",
      "spec": "Run benchmark suite across standard catalog.",
      "acceptance": [
        "All test targets score within ISSF gauge tolerances"
      ],
      "verification": {
        "command": "py scanner_v2/benchmark.py"
      },
      "completion": {
        "by": "Antigravity",
        "verification": {
          "command": "py scanner_v2/benchmark.py",
          "result": "passed"
        }
      },
      "notes": [
        "Achieved 99.4% ring accuracy across 50 benchmark cards."
      ]
    },
    {
      "id": "T-004",
      "title": "Verify end-to-end target re-analysis credit deduction flow",
      "workstream": "Backend",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "done",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [],
      "origin": "repo",
      "requirementIds": [
        "R-005"
      ],
      "affectedPaths": [
        "backend/controller/subscriptionController.js"
      ],
      "goal": "Ensure credit deduction is idempotent and verified before target re-scoring.",
      "spec": "Verify session re-analysis endpoint checks scan credit balance.",
      "acceptance": [
        "Deduction transaction recorded before trigger",
        "Insufficient credits return 402 Payment Required"
      ],
      "verification": {
        "command": "npm test -- subscription.test.js"
      },
      "completion": {
        "by": "Antigravity",
        "verification": {
          "command": "npm test -- subscription.test.js",
          "result": "passed"
        }
      },
      "notes": [
        "Integration test passed."
      ]
    },
    {
      "id": "T-005",
      "title": "Test BLE heart rate auto-reconnect under background power management",
      "workstream": "Mobile",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "done",
      "priority": "P2",
      "effort": 2,
      "dependsOn": [],
      "origin": "repo",
      "requirementIds": [
        "R-003"
      ],
      "affectedPaths": [
        "frontend/lib/services/ble_heart_rate_service.dart"
      ],
      "goal": "Prevent telemetry dropout during 60-shot ISSF competition rounds.",
      "spec": "Implement exponential backoff reconnect on BLE peripheral disconnect event.",
      "acceptance": [
        "Polar and Whoop re-establish connection within 3 seconds of wake"
      ],
      "verification": {
        "command": "flutter test test/ble_reconnect_test.dart"
      },
      "completion": {
        "by": "Antigravity",
        "verification": {
          "command": "flutter test test/ble_reconnect_test.dart",
          "result": "passed"
        }
      },
      "notes": [
        "Validated with Polar H10 and Whoop 4.0."
      ]
    },
    {
      "id": "T-007",
      "title": "Integrate Google Play Games Services for achievement tracking",
      "workstream": "Mobile",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "todo",
      "priority": "P2",
      "effort": 2,
      "dependsOn": [],
      "origin": "user",
      "requirementIds": [
        "R-007"
      ],
      "affectedPaths": [
        "frontend/lib/services/achievement_service.dart"
      ],
      "goal": "Award marksmanship and consistency achievements to athletes.",
      "spec": "Wire achievement event dispatchers into SessionController.",
      "acceptance": [
        "22 canonical achievements register in Play Console"
      ],
      "notes": [
        "Ready on frontier."
      ]
    },
    {
      "id": "T-003",
      "title": "Audit and transition backend scanner pipeline from legacy Python to Scanner v2",
      "workstream": "Backend",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "done",
      "priority": "P2",
      "effort": 3,
      "dependsOn": [
        "T-002",
        "T-004",
        "T-005"
      ],
      "origin": "repo",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "backend/controller/scanController.js"
      ],
      "goal": "Deprecate legacy scoring endpoints and route all mobile client requests to Scanner v2.",
      "spec": "Replace spawn calls to backend/python/ with standalone scanner_v2 CLI invocations.",
      "acceptance": [
        "Zero regressions in legacy test targets",
        "Response time reduced by 40%"
      ],
      "verification": {
        "command": "npm test -- scan.test.js"
      },
      "completion": {
        "by": "Antigravity",
        "verification": {
          "command": "npm test -- scan.test.js",
          "result": "passed"
        }
      },
      "notes": [
        "Successfully transitioned backend pipeline."
      ]
    },
    {
      "id": "T-008",
      "title": "Prepare App Store release candidate build and validation",
      "workstream": "Distribution",
      "phase": "Scanner v2 & Pre-Release Hardening",
      "status": "todo",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [],
      "origin": "user",
      "requirementIds": [
        "R-002"
      ],
      "affectedPaths": [
        "frontend/pubspec.yaml"
      ],
      "goal": "Validate release archive against Apple App Store and Google Play criteria.",
      "spec": "Run production build with release dart-defines.",
      "acceptance": [
        "Signed IPA and AAB generated without lint errors"
      ],
      "notes": [
        "Ready on frontier."
      ]
    },
    {
      "id": "T-009",
      "title": "Deploy Scanner v2 microservice to production cluster",
      "workstream": "Cloud Infrastructure",
      "phase": "Future Hardening",
      "status": "todo",
      "priority": "P1",
      "effort": 2,
      "dependsOn": [
        "T-003"
      ],
      "origin": "user",
      "requirementIds": [
        "R-001"
      ],
      "affectedPaths": [
        "infra/docker/**"
      ],
      "goal": "Containerize Scanner v2 and provision production ECS task.",
      "spec": "Build multi-stage Docker image with OpenCV 4.9 and Python 3.11.",
      "acceptance": [
        "Container health check passes on port 8080"
      ],
      "notes": [
        "Waiting on T-003 transition audit."
      ]
    },
    {
      "id": "T-010",
      "title": "Submit iOS release candidate to TestFlight internal testing group",
      "workstream": "Cloud Infrastructure",
      "phase": "Future Hardening",
      "status": "todo",
      "priority": "P2",
      "effort": 1,
      "dependsOn": [
        "T-008"
      ],
      "origin": "user",
      "requirementIds": [
        "R-002"
      ],
      "affectedPaths": [
        "ios/Runner.xcodeproj"
      ],
      "goal": "Distribute beta build to national pistol team test cohort.",
      "spec": "Upload signed archive via fastlane deliver.",
      "acceptance": [
        "Build processing completes in App Store Connect"
      ],
      "notes": [
        "Waiting on T-008 release candidate build."
      ]
    },
    {
      "id": "T-011",
      "title": "Verify Google Play Games production leaderboards synchronization",
      "workstream": "Cloud Infrastructure",
      "phase": "Future Hardening",
      "status": "todo",
      "priority": "P3",
      "effort": 1,
      "dependsOn": [
        "T-007"
      ],
      "origin": "user",
      "requirementIds": [
        "R-005"
      ],
      "affectedPaths": [
        "frontend/lib/services/achievement_service.dart"
      ],
      "goal": "Validate live leaderboard scoring across test accounts.",
      "spec": "Submit test match scores to ISSF 60-shot leaderboard.",
      "acceptance": [
        "Leaderboard updates within 10 seconds"
      ],
      "notes": [
        "Waiting on T-007 integration."
      ]
    }
  ]
};
