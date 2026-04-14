# QA Pipeline Troubleshooting

## Common Failures

### `set -euo pipefail` + grep with no match

**Symptom**: Deploy script crashes silently, badge shows FAILED.
**Cause**: `grep -oP` returns exit code 1 when no match. Under `pipefail`, this kills the entire script.
**Fix**: Always append `|| true` to grep pipelines in bash scripts.

### `__name is not defined` in page.evaluate

**Symptom**: Recording crashes with `ReferenceError: __name is not defined`.
**Cause**: tsx compiles arrow functions inside `page.evaluate()` with `__name` helpers. The browser context doesn't have these.
**Fix**: Use `page.addScriptTag({ content: '...' })` with plain JS strings instead of `page.evaluate(() => { ... })` with arrow functions.

### `Set<string>()` in page.evaluate

**Symptom**: Same `__name` error.
**Cause**: TypeScript generics like `new Set<string>()` get compiled incorrectly for browser context.
**Fix**: Use `new Set()` without type parameter.

### `zod/v4` import error

**Symptom**: `ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './v4' is not defined`.
**Cause**: claude-agent-sdk depends on `zod/v4` internally, but the project's zod doesn't export it.
**Fix**: Import from `zod` (not `zod/v4`) in project code.

### `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

**Symptom**: pnpm install fails with frozen lockfile mismatch.
**Cause**: Adding a new dependency changes the workspace catalog but lockfile wasn't regenerated.
**Fix**: Run `pnpm install` to regenerate lockfile, commit `pnpm-workspace.yaml` + `pnpm-lock.yaml`.

### `loadDefaultWorkflow` — "Load Default" not found

**Symptom**: Menu item "Load Default" not found, canvas stays empty.
**Cause**: The menu item name varies by version/locale. Menu navigation is fragile.
**Fix**: Use `app.resetToDefaultWorkflow()` JS API via `page.evaluate` instead of menu navigation.

### Model ID not found (Claude Agent SDK)

**Symptom**: `There's an issue with the selected model (claude-sonnet-4-6-20250514)`.
**Cause**: Dated model IDs like `claude-sonnet-4-6-20250514` don't exist.
**Fix**: Use `claude-sonnet-4-6` (no date suffix).

### Model not found (Gemini)

**Symptom**: 404 from Gemini API.
**Cause**: Preview model names like `gemini-2.5-flash-preview-05-20` expire.
**Fix**: Use `gemini-3-flash-preview` (latest stable).

## Badge Mismatches

### False REPRODUCED

**Symptom**: Badge says REPRODUCED but AI review says "could not reproduce".
**Root cause**: Grep pattern `reproduc|confirm` matches neutral words like "reproduction steps" or "could not be confirmed".
**Fix**: Use structured JSON verdict from AI (`## Verdict` section with `{"verdict": "..."}`) instead of regex matching the prose.

### INCONCLUSIVE feedback loop

**Symptom**: Once an issue gets INCONCLUSIVE, all future runs stay INCONCLUSIVE.
**Cause**: QA bot's own previous comments contain "INCONCLUSIVE", which gets fed back into pr-context.txt.
**Fix**: Filter out `github-actions[bot]` comments when building pr-context.

### pressKey with hold prevents event propagation

**Symptom**: BEFORE video doesn't show the bug (e.g., Escape doesn't close dialog).
**Cause**: `keyboard.down()` + 400ms sleep + `keyboard.up()` changes event timing. Some UI frameworks handle held keys differently than instant presses.
**Fix**: Use instant `keyboard.press()` for testing. Show key name via subtitle overlay instead.

## Cursor Not Visible

**Symptom**: No mouse cursor in recorded videos.
**Cause**: Headless Chrome doesn't render system cursor. The CSS cursor overlay relies on DOM `mousemove` events which Playwright CDP doesn't reliably trigger.
**Fix**: Monkey-patch `page.mouse.move/click/dblclick/down/up` to call `__moveCursor(x,y)` on the injected cursor div. This makes ALL mouse operations update the overlay.

## Credit Balance Too Low

**Symptom**: Research phase produces INCONCLUSIVE with 0 tool calls. Log shows "Credit balance is too low".
**Cause**: The `ANTHROPIC_API_KEY` secret in the repo has exhausted its credits.
**Fix**: Top up the Anthropic API account linked to the key, or rotate to a new key in repo Settings → Secrets.

## Agent Doesn't Perform Steps

**Symptom**: Agent opens menus and settings but never interacts with the canvas.
**Causes**:

1. `loadDefaultWorkflow` failed (no nodes on canvas)
2. Agent ran out of turn budget (30 turns / 120s)
3. Gemini Flash (old agent) ignores prompt hints
   **Fix**: Use hybrid agent (Claude Sonnet 4.6 + Gemini vision). Claude's superior reasoning follows instructions precisely.

## False REPRODUCED from Discovery Tests

**Symptom**: Badge says REPRODUCED but the test was a debug/discovery test (e.g., "Find String Multiline node type") with trivial assertions like `expect(x).toBeDefined()`.
**Cause**: The auto-complete logic saved any passing test as proof of reproduction, including discovery tests that pass trivially.
**Fix**: Auto-complete now validates test code for bug-specific assertions — discovery tests (with names containing "Inspect", "Find", "Debug") and trivial assertions (`toBeDefined()`, `toBeGreaterThan(0)`) are excluded from auto-save.
