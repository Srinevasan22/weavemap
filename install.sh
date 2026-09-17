#!/usr/bin/env bash
set -e

REPO_BASE="https://raw.githubusercontent.com/Srinevasan22/weavemap/main"
TARGET_DIR="weavemap"

echo "🗺️  Installing WeaveMap into ./${TARGET_DIR}..."

mkdir -p "$TARGET_DIR"

RUNTIME_FILES=("PROTOCOL.md" "index.html" "app.js" "style.css")

for file in "${RUNTIME_FILES[@]}"; do
  echo "  ⬇️  Downloading ${file}..."
  curl -fsSL "${REPO_BASE}/${file}" -o "${TARGET_DIR}/${file}"
done

if [ ! -f "${TARGET_DIR}/state.js" ]; then
  echo "  ⬇️  Initializing blank ${TARGET_DIR}/state.js..."
  curl -fsSL "${REPO_BASE}/state.js" -o "${TARGET_DIR}/state.js"
else
  echo "  🔒 Existing ${TARGET_DIR}/state.js preserved."
fi

echo ""
echo "✨ WeaveMap installed successfully!"
echo ""
echo "Next step: Tell your AI coding assistant:"
echo '  "Read weavemap/PROTOCOL.md and use WeaveMap to manage this project as you work."'
echo ""
echo "Open ${TARGET_DIR}/index.html anytime to inspect or steer your project."
