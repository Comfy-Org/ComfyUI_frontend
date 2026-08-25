#!/usr/bin/env bash
set -euo pipefail

# Navigate to repo root (script location relative)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🎭 Updating Playwright agent definitions..."
echo ""

# Step 1: Regenerate base agent files
echo "Step 1: Running init-agents..."
cd "$REPO_ROOT"
pnpm exec playwright init-agents --loop=claude

echo ""
echo "Step 2: Applying ComfyUI patches..."
node "$SCRIPT_DIR/patch-playwright-agents.js"

echo ""
echo "✅ Agent files updated and patched."
echo ""
echo "Files modified:"
echo "  .claude/agents/playwright-test-planner.md"
echo "  .claude/agents/playwright-test-generator.md"
echo "  .claude/agents/playwright-test-healer.md"
echo ""
echo "Review changes with: git diff .claude/agents/"
