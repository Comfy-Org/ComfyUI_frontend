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

## Research Phase (`qa-agent.ts`)

Claude receives the issue/PR context + a11y tree snapshot + ComfyPage fixture API docs.

Tools:

- **`inspect(selector?)`** — Read a11y tree
- **`readFixture(path)`** — Read fixture source code
- **`readTest(path)`** — Read existing tests for patterns
- **`writeTest(code)`** — Write a Playwright .spec.ts
- **`runTest()`** — Execute and get pass/fail + errors
- **`done(verdict, summary, evidence, testCode, videoScript?)`** — Finish

When `verdict=REPRODUCED`, Claude also provides a `videoScript` — a separate test file using demowright's `createVideoScript()` for professional narrated demo video with title cards, TTS segments, and outro.

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

## Prerequisites

- `GEMINI_API_KEY` — video review, TTS
- `ANTHROPIC_API_KEY` — Claude Agent SDK (research phase)
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — report deployment (CI only)
- ComfyUI server running (auto-detected, or auto-started)

## CI Workflow (`.github/workflows/pr-qa.yaml`)

```
resolve-matrix → analyze-pr ──┐
                               ├→ qa-before (main branch)
                               ├→ qa-after  (PR branch)
                               └→ report (video review, deploy, comment)
```
