---
name: comfy-qa
description: 'Comprehensive QA of ComfyUI frontend. Reproduces bugs via E2E tests, records narrated demo videos, deploys reports. Works in CI and locally via `pnpm qa`.'
---

# ComfyUI Frontend QA Skill

Automated quality assurance pipeline that reproduces reported bugs using Playwright E2E tests, records narrated demo videos with demowright, and deploys reports to Cloudflare Pages.

## Quick Start

```bash
# Reproduce an issue
pnpm qa 10253

# Test a PR
pnpm qa 10270

# Test PR base (reproduce bug)
pnpm qa 10270 -t base

# Test both base + head
pnpm qa 10270 -t both

# Test local uncommitted changes
pnpm qa --uncommitted

# Help
pnpm qa -h
```

Auto-loads `.env.local` / `.env` for `GEMINI_API_KEY` and `ANTHROPIC_API_KEY`.
Auto-detects issue vs PR via GitHub API. Auto-starts ComfyUI if not running.

## Architecture

Three-phase pipeline:

1. **RESEARCH** — Claude Sonnet 4.6 (Agent SDK) writes Playwright E2E tests to reproduce bugs
2. **RECORD** — Re-runs test with demowright for narrated demo video (title cards, TTS, subtitles)
3. **REPORT** — Gemini reviews video, deploys to Cloudflare Pages with badge + verdict

Key principle: **Playwright assertions are truth** — no AI hallucination. If the test passes, the bug is proven.

## Pipeline Scripts

All scripts live in `.claude/skills/comfy-qa/scripts/`:

| Script                    | Role                                                  |
| ------------------------- | ----------------------------------------------------- |
| `qa.ts`                   | CLI entry point (`pnpm qa`)                           |
| `qa-agent.ts`             | Research phase: Claude writes E2E tests via Agent SDK |
| `qa-record.ts`            | Orchestrator: 3-phase pipeline                        |
| `qa-deploy-pages.sh`      | Cloudflare Pages deploy + badge generation            |
| `qa-report-template.html` | Report site template                                  |
| `qa-video-review.ts`      | Gemini video review                                   |
| `qa-analyze-pr.ts`        | Deep PR/issue analysis → QA guide                     |
| `qa-generate-test.ts`     | Regression test generation from QA report             |
| `qa-reproduce.ts`         | Deterministic replay with narration                   |
| `scripts/qa-batch.sh`     | Batch-trigger QA for multiple issues                  |

## Triggering QA

### Via CLI (`pnpm qa`)

```bash
pnpm qa 10253                  # issue (auto-detect)
pnpm qa 10270                  # PR head
pnpm qa 10270 -t base          # PR base
pnpm qa 10270 -t both          # both
pnpm qa --uncommitted          # local changes
```

### Via GitHub Labels

- **`qa-issue`** — Reproduce a bug from an issue
- **`qa-changes`** — Focused QA on a PR (Linux-only, before/after)
- **`qa-full`** — Full QA (3-OS matrix)

### Via Push to trigger branches

```bash
git push origin sno-skills:sno-qa-10253 --force
```

### Via Batch Script

```bash
./scripts/qa-batch.sh 10394 10238 9996
./scripts/qa-batch.sh --from tmp/issues.md --top 5
./scripts/qa-batch.sh --dry-run 10394
./scripts/qa-batch.sh --cleanup
```

## Research Phase (`qa-agent.ts`)

Claude receives the issue/PR context + a11y tree snapshot + ComfyPage fixture API docs.

Tools:

- **`inspect(selector?)`** — Read a11y tree
- **`readFixture(path)`** — Read fixture source code
- **`readTest(path)`** — Read existing tests for patterns
- **`downloadAttachment(url)`** — Fetch URL contents (GitHub user-attachments, gist raw) — for workflow JSON attached to issues
- **`loadWorkflow(json)`** — Load a workflow into the canvas via `window.app.loadGraphData()` so `inspect()` reflects the user's graph state
- **`writeTest(code)`** — Write a Playwright .spec.ts
- **`runTest()`** — Execute and get pass/fail + errors
- **`done(verdict, summary, evidence, testCode, videoScript?)`** — Finish

When the issue attaches a workflow.json, the agent is instructed to `downloadAttachment` then `loadWorkflow` before inspecting — many bugs only manifest in the user's specific graph state. The emitted test must itself re-fetch and `loadGraphData()` because `runTest` spawns a fresh browser.

When `verdict=REPRODUCED`, Claude also provides a `videoScript` — a separate test file using demowright's `createVideoScript()` for professional narrated demo video with title cards, TTS segments, and outro.

### Verdict Logic

- **REPRODUCED** — Test passes (asserting the bug exists) → bug is proven
- **NOT_REPRODUCIBLE** — Claude exhausted attempts, test cannot pass
- **INCONCLUSIVE** — Agent timed out or encountered infrastructure issues

Auto-completion: if a test passed with a bug-specific assertion but `done()` was never called, the pipeline auto-completes with REPRODUCED. Trivial assertions (`toBeDefined()`, `toBeGreaterThan(0)`) and discovery-style tests are excluded from auto-save to avoid false positives.

## Video Recording (demowright)

Phase 2 uses the video script to record with:

- `showTitleCard()` / `hideTitleCard()` — covers setup/loading screen
- `createVideoScript().title().segment().outro()` — structured narration
- `pace()` — narration-then-action timing
- TTS audio + subtitles + cursor overlay + key badges

## Report Site

Deployed to `https://sno-qa-{number}.comfy-qa.pages.dev/`

Features:

- Video player (1x default, adjustable speed)
- Research log (verdict, tool calls, timing)
- E2E test code + video script code
- Verdict banner for NOT_REPRODUCIBLE/INCONCLUSIVE with failure reason
- Copy badge button (markdown)
- Date-stamped badges, vertical box badge for issues and PRs

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

## Prerequisites

- Node.js 22+
- `pnpm` package manager
- `gh` CLI (authenticated)
- Playwright browsers: `npx playwright install chromium`
- Environment variables:
  - `GEMINI_API_KEY` — PR analysis, video review, TTS
  - `ANTHROPIC_API_KEY` — Claude Agent SDK (research phase)
  - `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — report deployment (CI only)
- ComfyUI server running (auto-detected, or auto-started)

## Manual QA (Fallback)

When the automated pipeline isn't suitable (e.g., visual-only bugs, complex multi-step interactions), use **playwright-cli** for manual browser interaction:

```bash
npm install -g @playwright/cli@latest

playwright-cli open http://127.0.0.1:8188
playwright-cli snapshot
playwright-cli click e1
playwright-cli fill e2 "test text"
playwright-cli press Escape
playwright-cli screenshot --filename=f.png
```

Snapshots return element references (`e1`, `e2`, …). Always run `snapshot` after navigation to refresh refs.

## Manual QA Test Plan

When performing manual QA systematically, cover each area below.

### Application Load & Routes

| Test              | Steps                                                        |
| ----------------- | ------------------------------------------------------------ |
| Root route loads  | Navigate to `/` — GraphView should render with canvas        |
| User select route | Navigate to `/user-select` — user selection UI should appear |
| 404 handling      | Navigate to `/nonexistent` — should handle gracefully        |

### Canvas & Graph View

| Test                      | Steps                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Canvas renders            | The LiteGraph canvas is visible and interactive                |
| Pan canvas                | Click and drag on empty canvas area                            |
| Zoom in/out               | Use scroll wheel or Alt+=/Alt+-                                |
| Add node via double-click | Double-click canvas to open search, type "KSampler", select it |
| Delete node               | Select a node, press Delete key                                |
| Connect nodes             | Drag from output slot to input slot                            |
| Copy/Paste                | Select nodes, Ctrl+C then Ctrl+V                               |
| Undo/Redo                 | Make changes, Ctrl+Z to undo, Ctrl+Y to redo                   |
| Context menus             | Right-click node vs empty canvas — different menus             |

### Sidebar Tabs

| Test              | Steps                                 |
| ----------------- | ------------------------------------- |
| Workflows tab     | Press W — workflows sidebar opens     |
| Node Library tab  | Press N — node library opens          |
| Model Library tab | Press M — model library opens         |
| Tab toggle        | Press same key again — sidebar closes |
| Search in sidebar | Type in search box — results filter   |

### Settings Dialog

| Test             | Steps                                                |
| ---------------- | ---------------------------------------------------- |
| Open settings    | Press Ctrl+, or click settings button                |
| Change a setting | Toggle a boolean setting — it persists after closing |
| Search settings  | Type in settings search box — results filter         |
| Close settings   | Press Escape or click close button                   |

### Execution & Queue

| Test           | Steps                                                 |
| -------------- | ----------------------------------------------------- |
| Queue prompt   | Load default workflow, click Queue — execution starts |
| Queue progress | Progress indicator shows during execution             |
| Interrupt      | Press Ctrl+Alt+Enter during execution — interrupts    |

## Known Issues & Troubleshooting

See `docs/qa/TROUBLESHOOTING.md` for common failures:

- `set -euo pipefail` + grep with no match → append `|| true`
- `__name is not defined` in `page.evaluate` → use `addScriptTag`
- Cursor not visible in videos → monkey-patch `page.mouse` methods
- Agent not calling `done()` → auto-complete from passing test with bug-specific assertion

## Backlog

See `docs/qa/backlog.md` for planned improvements:

- **Type B comparison**: Different commits for regression detection
- **Type C comparison**: Cross-browser testing
- **Pre-seed assets**: Upload test images before recording (for #10424-style bugs)
- **Custom node install in CI**: Requires backend-in-CI (`comfy node install`); see `QA_REPRODUCE_IMPROVEMENT.md`
- **Lazy a11y tree**: Reduce token usage with `inspect(selector)` vs full dump
