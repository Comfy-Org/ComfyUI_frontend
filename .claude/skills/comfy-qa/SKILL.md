---
name: comfy-qa
description: 'Comprehensive QA of ComfyUI frontend. Navigates all routes, tests all interactive features using playwright-cli, generates a report, and submits a draft PR. Works in CI and local environments, cross-platform.'
---

# ComfyUI Frontend QA Skill

Automated quality assurance for the ComfyUI frontend. The pipeline reproduces reported bugs using Playwright E2E tests, records video evidence, and deploys reports to Cloudflare Pages.

## Architecture Overview

The QA pipeline uses a **three-phase approach**:

1. **RESEARCH** — Claude writes Playwright E2E tests to reproduce bugs (assertion-backed, no hallucination)
2. **REPRODUCE** — Deterministic replay of the research test with video recording
3. **REPORT** — Deploy results to Cloudflare Pages with badge, video, and verdict

### Key Design Decision

Earlier iterations used AI vision (Gemini) to drive a browser and judge results from video. This was abandoned after discovering **AI reviewers hallucinate** — Gemini reported "REPRODUCED" when videos showed idle screens. The current approach uses **Playwright assertions** as the source of truth: if the test passes, the bug is proven.

## Prerequisites

- Node.js 22+
- `pnpm` package manager
- `gh` CLI (authenticated)
- Playwright browsers: `npx playwright install chromium`
- Environment variables:
  - `GEMINI_API_KEY` — for PR analysis and video review
  - `ANTHROPIC_API_KEY` — for Claude Agent SDK (research phase)
  - `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — for report deployment

## Pipeline Scripts

| Script | Role | Model |
|---|---|---|
| `scripts/qa-analyze-pr.ts` | Deep PR/issue analysis → QA guide | gemini-3.1-pro-preview |
| `scripts/qa-agent.ts` | Research phase: Claude writes E2E tests | claude-sonnet-4-6 (Agent SDK) |
| `scripts/qa-record.ts` | Before/after video recording with Gemini-driven actions | gemini-3.1-pro-preview |
| `scripts/qa-reproduce.ts` | Deterministic replay with narration | gemini-3-flash-preview |
| `scripts/qa-video-review.ts` | Video comparison review | gemini-3-flash-preview |
| `scripts/qa-generate-test.ts` | Regression test generation from QA report | gemini-3-flash-preview |
| `scripts/qa-deploy-pages.sh` | Deploy to Cloudflare Pages + badge | — |
| `scripts/qa-batch.sh` | Batch-trigger QA for multiple issues | — |
| `scripts/qa-report-template.html` | Report site (light/dark, seekbar, copy badge) | — |

## Triggering QA

### Via GitHub Labels

- **`qa-changes`** — Focused QA on a PR (Linux-only, before/after comparison)
- **`qa-full`** — Full QA (3-OS matrix, after-only)
- **`qa-issue`** — Reproduce a bug from an issue

### Via Batch Script

```bash
# Trigger QA for specific issue numbers
./scripts/qa-batch.sh 10394 10238 9996

# From a triage file (top 5 Tier 1 issues)
./scripts/qa-batch.sh --from tmp/issues.md --top 5

# Preview without pushing
./scripts/qa-batch.sh --dry-run 10394

# Clean up old trigger branches
./scripts/qa-batch.sh --cleanup
```

### Via Workflow Dispatch

Go to Actions → "PR: QA" → Run workflow → choose mode (focused/full).

## CI Workflow (`.github/workflows/pr-qa.yaml`)

```
resolve-matrix → analyze-pr ──┐
                               ├→ qa-before (main branch, worktree build)
                               ├→ qa-after  (PR branch)
                               └→ report (video review, deploy, comment)
```

Before/after jobs run **in parallel** on separate runners for clean isolation.

### Issue Reproduce Mode

For issues (not PRs), the pipeline:
1. Fetches the issue body and comments
2. Runs `qa-analyze-pr.ts --type issue` to generate a QA guide
3. Runs the research phase (Claude writes E2E test to reproduce)
4. Records video of the test execution
5. Posts results as a comment on the issue

## Running Locally

### Step 1: Environment Setup

```bash
# Ensure ComfyUI server is running
# Default: http://127.0.0.1:8188

# Install Playwright browsers
npx playwright install chromium
```

### Step 2: Analyze the Issue/PR

```bash
# For a PR
pnpm exec tsx scripts/qa-analyze-pr.ts \
  --pr-number 10394 \
  --repo Comfy-Org/ComfyUI_frontend \
  --output-dir qa-guides

# For an issue
pnpm exec tsx scripts/qa-analyze-pr.ts \
  --pr-number 10394 \
  --repo Comfy-Org/ComfyUI_frontend \
  --output-dir qa-guides \
  --type issue
```

### Step 3: Record Before/After

```bash
# Before (main branch)
pnpm exec tsx scripts/qa-record.ts \
  --mode before \
  --diff /tmp/pr-diff.txt \
  --output-dir /tmp/qa-before \
  --qa-guide qa-guides/qa-guide-1.json

# After (PR branch)
pnpm exec tsx scripts/qa-record.ts \
  --mode after \
  --diff /tmp/pr-diff.txt \
  --output-dir /tmp/qa-after \
  --qa-guide qa-guides/qa-guide-1.json
```

### Step 4: Review Videos

```bash
pnpm exec tsx scripts/qa-video-review.ts \
  --artifacts-dir /tmp/qa-artifacts \
  --video-file qa-session.mp4 \
  --before-video qa-before-session.mp4 \
  --output-dir /tmp/video-reviews \
  --pr-context /tmp/pr-context.txt
```

## Research Phase Details (`qa-agent.ts`)

Claude receives:
- The issue description and comments
- A QA guide from `qa-analyze-pr.ts`
- An accessibility tree snapshot of the current UI

Claude's tools:
- **`inspect(selector?)`** — Read a11y tree to discover element selectors
- **`writeTest(code)`** — Write a Playwright `.spec.ts` file
- **`runTest()`** — Execute the test and get pass/fail + errors
- **`done(verdict, summary, evidence, testCode)`** — Finish with verdict

The test uses the project's Playwright fixtures (`comfyPageFixture`), giving access to `comfyPage.page`, `comfyPage.menu`, `comfyPage.settings`, etc.

### Verdict Logic

- **REPRODUCED** — Test passes (asserting the bug exists) → bug is proven
- **NOT_REPRODUCIBLE** — Claude exhausted attempts, test cannot pass
- **INCONCLUSIVE** — Agent timed out or encountered infrastructure issues

Auto-completion: if a test passed but `done()` was never called, the pipeline auto-completes with REPRODUCED.

## Manual QA (Fallback)

When the automated pipeline isn't suitable (e.g., visual-only bugs, complex multi-step interactions), use **playwright-cli** for manual browser interaction:

```bash
# Install
npm install -g @playwright/cli@latest

# Open browser and navigate
playwright-cli open http://127.0.0.1:8188

# Get element references
playwright-cli snapshot

# Interact
playwright-cli click e1
playwright-cli fill e2 "test text"
playwright-cli press Escape
playwright-cli screenshot --filename=f.png
```

Snapshots return element references (`e1`, `e2`, …). Always run `snapshot` after navigation to refresh refs.

## Manual QA Test Plan

When performing manual QA (either via playwright-cli or the automated pipeline), systematically test each area below.

### Application Load & Routes

| Test | Steps |
|---|---|
| Root route loads | Navigate to `/` — GraphView should render with canvas |
| User select route | Navigate to `/user-select` — user selection UI should appear |
| 404 handling | Navigate to `/nonexistent` — should handle gracefully |

### Canvas & Graph View

| Test | Steps |
|---|---|
| Canvas renders | The LiteGraph canvas is visible and interactive |
| Pan canvas | Click and drag on empty canvas area |
| Zoom in/out | Use scroll wheel or Alt+=/Alt+- |
| Add node via double-click | Double-click canvas to open search, type "KSampler", select it |
| Delete node | Select a node, press Delete key |
| Connect nodes | Drag from output slot to input slot |
| Copy/Paste | Select nodes, Ctrl+C then Ctrl+V |
| Undo/Redo | Make changes, Ctrl+Z to undo, Ctrl+Y to redo |
| Context menus | Right-click node vs empty canvas — different menus |

### Sidebar Tabs

| Test | Steps |
|---|---|
| Workflows tab | Press W — workflows sidebar opens |
| Node Library tab | Press N — node library opens |
| Model Library tab | Press M — model library opens |
| Tab toggle | Press same key again — sidebar closes |
| Search in sidebar | Type in search box — results filter |

### Settings Dialog

| Test | Steps |
|---|---|
| Open settings | Press Ctrl+, or click settings button |
| Change a setting | Toggle a boolean setting — it persists after closing |
| Search settings | Type in settings search box — results filter |
| Close settings | Press Escape or click close button |

### Execution & Queue

| Test | Steps |
|---|---|
| Queue prompt | Load default workflow, click Queue — execution starts |
| Queue progress | Progress indicator shows during execution |
| Interrupt | Press Ctrl+Alt+Enter during execution — interrupts |

## Report Site

Deployed to Cloudflare Pages at `https://comfy-qa.pages.dev/<branch>/`.

Features:
- Light/dark theme
- Seekable video player with preload
- Copy badge button (markdown)
- Date-stamped badges (e.g., `QA0327`)
- Vertical box badge for issues and PRs

## Known Issues & Troubleshooting

See `docs/qa/TROUBLESHOOTING.md` for common failures:
- `set -euo pipefail` + grep with no match → append `|| true`
- `__name is not defined` in `page.evaluate` → use `addScriptTag`
- Cursor not visible in videos → monkey-patch `page.mouse` methods
- Agent not calling `done()` → auto-complete from passing test

## Backlog

See `docs/qa/backlog.md` for planned improvements:
- **Type B comparison**: Different commits for regression detection
- **Type C comparison**: Cross-browser testing
- **Pre-seed assets**: Upload test images before recording
- **Lazy a11y tree**: Reduce token usage with `inspect(selector)` vs full dump
