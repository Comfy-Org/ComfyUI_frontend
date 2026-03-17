#!/usr/bin/env bash
set -Eeo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "======================================================================"
echo "Building Branch Status Pages"
echo "======================================================================"
echo ""

# Helper function to create placeholder HTML
create_placeholder() {
  local dir="$1"
  local title="$2"
  local message="$3"

  mkdir -p "$dir"
  cat > "$dir/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$title</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 1rem;
      backdrop-filter: blur(10px);
      max-width: 600px;
    }
    h1 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>$title</h1>
    <p>$message</p>
  </div>
</body>
</html>
EOF
}

# ============================================================================
# Storybook (deployed separately to Cloudflare Pages)
# ============================================================================
echo "[build-pages] Setting up Storybook"
rm -rf ".pages/storybook"

if [ -d "./storybook-static" ] && [ "$(find ./storybook-static -name '*.html' 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "  Using local Storybook build"
  cp -r "./storybook-static" ".pages/storybook"
else
  echo "  Creating placeholder (Storybook deployed separately to comfy-storybook.pages.dev)"
  create_placeholder ".pages/storybook" "Storybook" \
    "Storybook is deployed separately. Check the PR comments for the Cloudflare Pages link."
fi

# ============================================================================
# Nx Dependency Graph
# ============================================================================
echo "[build-pages] Generating Nx dependency graph"
rm -rf ".pages/nx-graph" && mkdir -p ".pages/nx-graph"

if pnpm nx graph --file=".pages/nx-graph/index.html" 2>/dev/null; then
  echo "  Nx graph generated"
else
  echo "  Nx graph generation failed, creating placeholder"
  create_placeholder ".pages/nx-graph" "Nx Dependency Graph" \
    "Graph generation is not available in this environment."
fi

# ============================================================================
# Playwright E2E Test Reports (deployed separately to Cloudflare Pages)
# ============================================================================
echo "[build-pages] Setting up Playwright test reports"
rm -rf ".pages/playwright-reports" && mkdir -p ".pages/playwright-reports"

if [ -d "./playwright-report" ] && [ "$(find ./playwright-report -name '*.html' 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "  Using local Playwright reports"
  cp -r "./playwright-report/"* ".pages/playwright-reports/" 2>/dev/null || true
else
  echo "  Creating placeholder (Playwright reports deployed separately)"
  create_placeholder ".pages/playwright-reports" "E2E Test Reports" \
    "Playwright reports are deployed separately. Check the PR comments for Cloudflare Pages links."
fi

# ============================================================================
# Vitest Test Reports
# ============================================================================
echo "[build-pages] Setting up Vitest test reports"
rm -rf ".pages/vitest-reports" && mkdir -p ".pages/vitest-reports"

create_placeholder ".pages/vitest-reports" "Vitest Test Reports" \
  "Unit test results are available in CI. Check the GitHub Actions workflow run."

# ============================================================================
# Coverage Report
# ============================================================================
echo "[build-pages] Setting up coverage report"
mkdir -p ".pages/coverage"

create_placeholder ".pages/coverage" "Coverage Report" \
  "Code coverage is generated in CI. Check the GitHub Actions workflow run."

# ============================================================================
# Knip Report (Fast - generate fresh)
# ============================================================================
echo "[build-pages] Generating Knip report"
mkdir -p ".pages/knip"
rm -f ".pages/knip/report.md"

if pnpm knip --reporter markdown --no-progress --no-exit-code > ".pages/knip/report.md" 2>/dev/null && [ -s ".pages/knip/report.md" ]; then
  echo "  Knip report generated"
else
  echo "  Knip report failed, creating placeholder"
  cat > ".pages/knip/report.md" <<'EOF'
# Knip Report

> Knip report generation failed

Knip analysis could not be completed in this build environment.
Please check the CI logs for details.
EOF
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "======================================================================"
echo "Build Complete"
echo "======================================================================"
echo ""
echo "Generated artifacts in ./.pages:"
echo ""
ls -lh ".pages" 2>/dev/null | tail -n +2 | awk '{print "  " $9}'
echo ""
