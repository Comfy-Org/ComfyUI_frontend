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
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 2rem auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>$title</h1>
    <div class="spinner"></div>
    <p>$message</p>
  </div>
</body>
</html>
EOF
}

# ============================================================================
# Storybook
# ============================================================================
echo "[build-pages] Setting up Storybook"
rm -rf ".pages/storybook"

if [ -f ".page/storybook-url.txt" ]; then
  # Fetched Storybook URL available - create redirect
  STORYBOOK_URL=$(cat ".page/storybook-url.txt")
  echo "  ✅ Using Storybook from: $STORYBOOK_URL"
  mkdir -p ".pages/storybook"
  cat > ".pages/storybook/index.html" <<EOF
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0; url=$STORYBOOK_URL">
  <title>Redirecting to Storybook...</title>
</head>
<body>
  <p>Redirecting to <a href="$STORYBOOK_URL">Storybook</a>...</p>
</body>
</html>
EOF
elif [ -d "./storybook-static" ] && [ "$(find ./storybook-static -name '*.html' 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "  ✅ Using local Storybook build"
  cp -r "./storybook-static" ".pages/storybook"
elif [ -d ".page/storybook-static" ]; then
  echo "  ✅ Using fetched Storybook build"
  cp -r ".page/storybook-static" ".pages/storybook"
else
  echo "  ⚠️  No Storybook build available, creating placeholder"
  create_placeholder ".pages/storybook" "Storybook" \
    "Storybook is being built by CI. Please check back in a few minutes."
fi

# ============================================================================
# Nx Dependency Graph
# ============================================================================
echo "[build-pages] Generating Nx dependency graph"
rm -rf ".pages/nx-graph" && mkdir -p ".pages/nx-graph"

if pnpm nx graph --file=".pages/nx-graph/index.html" 2>/dev/null; then
  echo "  ✅ Nx graph generated"
else
  echo "  ⚠️  Nx graph generation failed, creating placeholder"
  create_placeholder ".pages/nx-graph" "Nx Dependency Graph" \
    "Graph generation is not available in this environment."
fi

# ============================================================================
# Playwright E2E Test Reports
# ============================================================================
echo "[build-pages] Setting up Playwright test reports"
rm -rf ".pages/playwright-reports" && mkdir -p ".pages/playwright-reports"

if [ -d ".page/playwright-reports" ] && [ "$(find .page/playwright-reports -name '*.html' 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "  ✅ Using fetched Playwright reports"
  cp -r ".page/playwright-reports/"* ".pages/playwright-reports/" 2>/dev/null || true
elif [ -d "./playwright-report" ] && [ "$(find ./playwright-report -name '*.html' 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "  ✅ Using local Playwright reports"
  cp -r "./playwright-report/"* ".pages/playwright-reports/" 2>/dev/null || true
else
  echo "  ℹ️  No Playwright reports available, creating placeholder"
  create_placeholder ".pages/playwright-reports" "E2E Test Reports" \
    "Playwright tests are running in CI. Results will appear here when complete."
fi

# ============================================================================
# Vitest Test Reports
# ============================================================================
echo "[build-pages] Setting up Vitest test reports"
rm -rf ".pages/vitest-reports" && mkdir -p ".pages/vitest-reports"

if [ -d ".page/vitest-reports" ] && [ -f ".page/vitest-reports/index.html" ]; then
  echo "  ✅ Using fetched Vitest reports"
  cp -r ".page/vitest-reports/"* ".pages/vitest-reports/" 2>/dev/null || true
else
  echo "  ℹ️  No Vitest reports available, creating placeholder"
  create_placeholder ".pages/vitest-reports" "Vitest Test Reports" \
    "Unit tests are running in CI. Results will appear here when complete."
fi

# ============================================================================
# Coverage Report (Optional - slow to generate)
# ============================================================================
echo "[build-pages] Setting up coverage report"
mkdir -p ".pages/coverage"

if [ -d ".page/coverage" ] && [ -f ".page/coverage/index.html" ]; then
  echo "  ✅ Using fetched coverage report"
  cp -r ".page/coverage/"* ".pages/coverage/" 2>/dev/null || true
else
  echo "  ℹ️  Coverage report not available (skipping generation in Vercel)"
  create_placeholder ".pages/coverage" "Coverage Report" \
    "Code coverage is generated in CI. Results will appear here when complete."
fi

# ============================================================================
# Knip Report (Fast - generate fresh)
# ============================================================================
echo "[build-pages] Generating Knip report"
mkdir -p ".pages/knip"
rm -f ".pages/knip/report.md"

if pnpm knip --reporter markdown --no-progress --no-exit-code > ".pages/knip/report.md" 2>/dev/null && [ -s ".pages/knip/report.md" ]; then
  echo "  ✅ Knip report generated"
else
  echo "  ⚠️  Knip report failed, creating placeholder"
  cat > ".pages/knip/report.md" <<'EOF'
# Knip Report

> ⚠️ Knip report generation failed

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
echo "Note: For local development, run:"
echo "  pnpm pages:dev"
echo ""
