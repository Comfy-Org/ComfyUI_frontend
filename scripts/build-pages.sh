#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"


# Build or reuse Storybook
echo "[build-pages] Setting up Storybook"
rm -rf ".pages/storybook"
if [ -d "./storybook-static" ] && [ "$(find ./storybook-static -name '*.html' | wc -l)" -gt 0 ]; then
  echo "✅ Reusing downloaded Storybook build"
  cp -r "./storybook-static" ".pages/storybook"
else
  echo "🔨 Building Storybook from source"
  pnpm build-storybook && cp -r "storybook-static" ".pages/storybook"
fi

echo "[build-pages] Generating Nx dependency graph"
rm -rf ".pages/nx-graph" && mkdir -p ".pages/nx-graph"
pnpm nx graph --file=".pages/nx-graph/index.html"

# Generate or reuse Vitest test reports
echo "[build-pages] Setting up Vitest test reports"
rm -rf ".pages/vitest-reports" && mkdir -p ".pages/vitest-reports"
if [ -d ".page/vitest-reports" ]; then
  echo "✅ Reusing downloaded Vitest reports"
  cp -r ".page/vitest-reports/"* ".pages/vitest-reports/" 2>/dev/null || echo "⚠️  No vitest reports to copy"
else
  echo "🔨 Generating Vitest reports from source"
  pnpm exec vitest \
    --reporter=json --outputFile.json=".pages/vitest-reports/results.json" \
    --reporter=html --outputFile.html=".pages/vitest-reports/index.html" \
    --run
fi

# Set up Playwright test reports if available
echo "[build-pages] Setting up Playwright test reports"
if [ -d ".page/playwright-reports" ]; then
  echo "✅ Reusing downloaded Playwright reports"
  mkdir -p ".pages/playwright-reports"
  cp -r ".page/playwright-reports/"* ".pages/playwright-reports/" 2>/dev/null || echo "⚠️  No playwright reports to copy"
fi

echo "[build-pages] Generating coverage report"
mkdir -p ".pages/coverage"
if pnpm exec vitest --run --coverage --coverage.reporter=html --coverage.reportsDirectory=".pages/coverage"; then
  echo "✅ Coverage report completed"
else
  echo "⚠️  Coverage report failed, continuing..."
fi

echo "[build-pages] Generating Knip report"
mkdir -p ".pages/knip"
rm -f ".pages/knip/report.md"
if pnpm knip --reporter markdown --no-progress --no-exit-code 2>/dev/null | sed 's/^\[log\] //' > ".pages/knip/report.md" && [ -s ".pages/knip/report.md" ]; then
  echo "✅ Knip report generated at .pages/knip/report.md"
else
  echo "⚠️  Knip report failed, creating placeholder..."
  cat > ".pages/knip/report.md" <<'EOF'
# Knip report

> ⚠️ Knip report unavailable.
>
> Generation failed during build. See CI logs for details.
EOF
fi

echo "[build-pages] Landing page already exists at .pages/index.html"

echo "[build-pages] Build artifacts ready in ./.pages"

echo "[build-pages] Note: For local dev, you can develop the .pages/index.html using:
  pnpm exec vite .pages
"
