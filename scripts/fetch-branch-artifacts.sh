#!/usr/bin/env bash
set -Eeo pipefail

# Fetch test artifacts from deployed sources for branch status page
# This script runs in Vercel's build environment to fetch test results
# without waiting for all CI to complete

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BRANCH="${VERCEL_GIT_COMMIT_REF:-$(git branch --show-current)}"
COMMIT_SHA="${VERCEL_GIT_COMMIT_SHA:-$(git rev-parse HEAD)}"

echo "[fetch-artifacts] Fetching artifacts for branch: $BRANCH (commit: ${COMMIT_SHA:0:7})"

# Create artifact staging directory
ARTIFACT_DIR=".page"
mkdir -p "$ARTIFACT_DIR"

# ============================================================================
# Fetch Storybook from Cloudflare Pages
# ============================================================================
fetch_storybook() {
  echo "[fetch-artifacts] Fetching Storybook from Cloudflare Pages..."

  # Try to get Storybook URL from recent PR comment
  if command -v gh &> /dev/null && [ -n "$GITHUB_TOKEN" ]; then
    # Get PR number for current branch
    PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [ -n "$PR_NUMBER" ]; then
      echo "  Found PR #$PR_NUMBER"

      # Look for Storybook URL in comments
      STORYBOOK_URL=$(gh api "repos/{owner}/{repo}/issues/$PR_NUMBER/comments" \
        --jq '.[] | select(.body | contains("Storybook")) | .body' 2>/dev/null \
        | grep -oP 'https://[a-z0-9]+-comfyui-frontend\.pages\.dev' \
        | head -1 || echo "")

      if [ -n "$STORYBOOK_URL" ]; then
        echo "  Found Storybook URL: $STORYBOOK_URL"

        # Download and extract storybook
        if curl -sSL "$STORYBOOK_URL" -o /dev/null -w "%{http_code}" | grep -q "200"; then
          echo "  ✅ Storybook is accessible, will reference URL"
          echo "$STORYBOOK_URL" > "$ARTIFACT_DIR/storybook-url.txt"
          return 0
        fi
      fi
    fi
  fi

  echo "  ⚠️  Could not fetch Storybook URL (will show placeholder)"
  return 1
}

# ============================================================================
# Fetch E2E Test Results from GitHub Actions
# ============================================================================
fetch_e2e_reports() {
  echo "[fetch-artifacts] Fetching E2E test results from GitHub Actions..."

  if ! command -v gh &> /dev/null; then
    echo "  ⚠️  GitHub CLI not installed, skipping E2E reports"
    return 1
  fi

  if [ -z "$GITHUB_TOKEN" ]; then
    echo "  ⚠️  GITHUB_TOKEN not set, skipping E2E reports"
    return 1
  fi

  # Get latest workflow run for this commit or branch
  WORKFLOW_RUN=$(gh api \
    "repos/{owner}/{repo}/actions/runs?head_sha=$COMMIT_SHA&status=completed" \
    --jq '.workflow_runs | map(select(.name == "Tests CI")) | .[0]' 2>/dev/null || echo "{}")

  RUN_ID=$(echo "$WORKFLOW_RUN" | jq -r '.id // empty')

  if [ -z "$RUN_ID" ]; then
    echo "  ℹ️  No completed test runs found for commit $COMMIT_SHA"

    # Try latest on branch instead
    RUN_ID=$(gh api \
      "repos/{owner}/{repo}/actions/runs?branch=$BRANCH&status=completed" \
      --jq '.workflow_runs | map(select(.name == "Tests CI")) | .[0].id // empty' 2>/dev/null || echo "")
  fi

  if [ -n "$RUN_ID" ]; then
    echo "  Found workflow run: $RUN_ID"

    # Download playwright-report artifact
    if gh run download "$RUN_ID" -n playwright-report -D "$ARTIFACT_DIR/playwright-reports" 2>/dev/null; then
      echo "  ✅ Downloaded E2E test reports"
      return 0
    else
      echo "  ℹ️  playwright-report artifact not yet available"
    fi
  else
    echo "  ℹ️  No completed workflow runs found"
  fi

  return 1
}

# ============================================================================
# Fetch Vitest Results from GitHub Actions
# ============================================================================
fetch_vitest_reports() {
  echo "[fetch-artifacts] Fetching Vitest results from GitHub Actions..."

  if ! command -v gh &> /dev/null || [ -z "$GITHUB_TOKEN" ]; then
    echo "  ⚠️  Skipping (GitHub CLI or token not available)"
    return 1
  fi

  # Similar logic to E2E, but for vitest artifacts
  RUN_ID=$(gh api \
    "repos/{owner}/{repo}/actions/runs?head_sha=$COMMIT_SHA&status=completed" \
    --jq '.workflow_runs | map(select(.name == "Vitest Tests")) | .[0].id // empty' 2>/dev/null || echo "")

  if [ -z "$RUN_ID" ]; then
    RUN_ID=$(gh api \
      "repos/{owner}/{repo}/actions/runs?branch=$BRANCH&status=completed" \
      --jq '.workflow_runs | map(select(.name == "Vitest Tests")) | .[0].id // empty' 2>/dev/null || echo "")
  fi

  if [ -n "$RUN_ID" ]; then
    echo "  Found workflow run: $RUN_ID"

    if gh run download "$RUN_ID" -n vitest-report -D "$ARTIFACT_DIR/vitest-reports" 2>/dev/null; then
      echo "  ✅ Downloaded Vitest reports"
      return 0
    else
      echo "  ℹ️  vitest-report artifact not yet available"
    fi
  else
    echo "  ℹ️  No completed Vitest runs found"
  fi

  return 1
}

# ============================================================================
# Main execution
# ============================================================================

echo ""
echo "======================================================================"
echo "Fetching Branch Artifacts"
echo "======================================================================"
echo ""

# Run all fetchers (don't fail if some are unavailable)
fetch_storybook || true
fetch_e2e_reports || true
fetch_vitest_reports || true

echo ""
echo "======================================================================"
echo "Artifact Fetch Complete"
echo "======================================================================"
echo ""
echo "Available artifacts:"
ls -lh "$ARTIFACT_DIR" 2>/dev/null || echo "  (none)"
echo ""
echo "Note: Missing artifacts will show placeholder content in the status page"
echo ""
