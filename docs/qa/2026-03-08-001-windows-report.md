# QA Report: ComfyUI Frontend

**Date**: 2026-03-08
**Environment**: CI (Windows, Chromium via Playwright MCP)
**Frontend Version**: ComfyUI_frontend v1.41.13 (commit e7d2fbba6989b85a533284f5edd5fc73cf15a633)
**Backend Version**: ComfyUI (running at http://127.0.0.1:8188)
**Agent**: Claude Sonnet 4.6
**Server URL**: http://127.0.0.1:8188
**Branch**: sno-skills

## Environment Note

The Playwright MCP server (`@playwright/mcp@0.0.68`) was not available as an injected tool in this agent execution context. The MCP server is configured via `mcp-config.json` and passed to the Claude CLI via `--mcp-config`, which is only active when the agent is launched through the CI workflow step. As a result, browser-based interactions were not possible in this run.

This report covers:

1. Code analysis of all new features merged since the last report (2026-03-07)
2. Static review of changes that affect testable behavior
3. Cross-referencing with prior macOS (2026-03-07) and Linux (2026-03-05) reports
4. Identification of new features requiring QA coverage

---

## Summary

| Category        | Pass  | Fail  | Skip                      | Total  |
| --------------- | ----- | ----- | ------------------------- | ------ |
| Routes & Load   | 0     | 0     | 4 (no browser tools)      | 4      |
| Canvas          | 0     | 0     | 14 (no browser tools)     | 14     |
| Node Operations | 0     | 0     | 10 (no browser tools)     | 10     |
| Sidebar         | 0     | 0     | 7 (no browser tools)      | 7      |
| Topbar          | 0     | 0     | 8 (no browser tools)      | 8      |
| Settings        | 0     | 0     | 7 (no browser tools)      | 7      |
| Bottom Panel    | 0     | 0     | 4 (no browser tools)      | 4      |
| Execution       | 0     | 0     | 5 (no browser tools + CI) | 5      |
| File Operations | 0     | 0     | 6 (no browser tools + CI) | 6      |
| Advanced        | 0     | 0     | 5 (no browser tools)      | 5      |
| Error Handling  | 0     | 0     | 5 (no browser tools)      | 5      |
| Responsive      | 0     | 0     | 3 (no browser tools)      | 3      |
| **Total**       | **0** | **0** | **78**                    | **78** |

---

## Results

All tests skipped due to Playwright MCP browser tools being unavailable in this execution context. See "Environment Note" above.

### Routes & Load

- [-] Root route loads — skip (no browser)
- [-] User-select route — skip (no browser)
- [-] Default redirect — skip (no browser)
- [-] 404 handling — skip (no browser)

### Canvas & Graph View

- [-] All canvas tests — skip (no browser)

### Node Operations

- [-] All node operation tests — skip (no browser)

### Sidebar Tabs

- [-] All sidebar tests — skip (no browser)

### Topbar & Workflow Tabs

- [-] All topbar tests — skip (no browser)

### Settings Dialog

- [-] All settings tests — skip (no browser)

### Bottom Panel

- [-] All bottom panel tests — skip (no browser)

### Execution & Queue

- [-] All execution tests — skip (no browser + no GPU)

### Workflow File Operations

- [-] All file operation tests — skip (no browser + CI file dialog restrictions)

### Advanced Features

- [-] All advanced tests — skip (no browser)

### Error Handling

- [-] All error handling tests — skip (no browser)

### Responsive & Accessibility

- [-] All responsive tests — skip (no browser)

---

## New Features Since Last Report (Code Analysis)

The following features were merged between 2026-03-05 and 2026-03-08 and require explicit QA verification in subsequent runs with browser tools available:

### Run Controls Redesign (`fix: align run controls with queue modal design #9134`)

- Batch count controls moved to **left** of the Run button
- Run button styling updated to match Figma queue modal spec: secondary background for batch + dropdown, primary for run button
- Heights normalized to match actionbar buttons
- New chevron SVG for dropdown/batch up/down

**Test items**: verify batch count placement left of run button; verify run button is visually primary (filled); verify dropdown arrow renders; verify batch increment/decrement works.

### Workflow Menu Quick Mode Toggle (`feat: Update workflow menu to allow quick toggling modes #9436`)

- Mode toggle button added to the workflow menu for easier discovery
- Current mode text shown in menu
- Specific app mode rendering removed
- Spacing around breadcrumbs menu increased
- New `base` button variant added

**Test items**: open workflow actions menu; verify current mode text displayed; verify mode toggle button works; verify mode change takes effect on target workflow.

### App Mode QA Feedback 2 (`feat/fix: App mode QA feedback 2 #9511`)

- Warning added to welcome screen and share dialog when all outputs removed from an app
- Fix: target workflow now correct when changing mode via tab right-click menu
- "Edit" vs "Build" text in app button is now conditional (based on whether app already defined)
- Empty apps sidebar tab button text updated for clarity
- Templates button removed from app mode (will be re-introduced later)

**Test items**: enter app mode; verify button text is "Edit" if app already defined, "Build" if not; right-click a workflow tab and change mode, verify the correct workflow is affected; add/remove all outputs and verify warning appears in share dialog.

### App Mode Progress Updates (`feat: App mode progress updates #9375`)

- Progress bar moved below preview thumbnail (was previously overlaying it)
- Interactive pending placeholder added
- In-progress items scoped to active workflow in output history

**Test items**: queue a prompt in app mode; verify progress bar appears below (not over) thumbnail; verify pending state shows interactive placeholder.

### App Mode Empty Graph Handling (`feat: App mode empty graph handling #9393`)

- Entering app mode with empty graph prompts user to load a template

**Test items**: clear the canvas; attempt to enter app mode; verify template prompt appears.

### More App Fixes (`More app fixes #9432`)

- z-index on app mode outputs increased (displays above zoomed image)
- "View job" toast button in mobile app mode goes to outputs tab
- Image previews: minimum zoom ~20%, maximum zoom ~50x
- Enter panel in linear mode has minimum size ~1/5 screen
- Drag-to-rearrange inputs no longer causes horizontal scrollbar
- Videos now display first frame instead of generic video icon
- Muted/Bypassed nodes excluded from app mode inputs/outputs

**Test items**: in app mode, zoom an image and verify outputs overlay above it; verify muted/bypassed nodes don't appear as app inputs or outputs; verify video previews show first frame.

### ComfyHub Workflow Sharing (`feat: workflow sharing and ComfyHub publish flow #8951`)

- Share dialog with URL generation and asset warnings
- ComfyHub publish wizard (Describe → Examples → Finish) with thumbnail upload and tags
- Profile gate flow; shared workflow URL loader with confirmation dialog
- Gated by feature flags

**Test items**: open workflow actions menu; look for "Share" option; if enabled by feature flag, verify share dialog opens with URL; verify asset warnings appear if workflow uses local models.

### Logo & Loading Indicator (`feat: add Logo C fill and Comfy wave loading indicator components #9433`)

- New `LogoCFillLoader` and `LogoComfyWaveLoader` SVG components
- Wave loader used as app loading screen in `App.vue` and `WorkspaceAuthGate.vue`
- Loader z-index raised above BlockUI overlay (z-1200) to prevent dim wash-out

**Test items**: hard-reload the page and observe the loading animation; verify the wave animation plays during initial load; verify loader disappears cleanly when app is ready.

### Transparent Image/Video Preview Backgrounds (`feat: Transparent background for the Image and Video Previews #9455`)

- Image and video preview nodes now use transparent backgrounds instead of solid fill

**Test items**: run a workflow with an image output; verify the preview node background is transparent; verify different aspect ratios look correct.

### Model Metadata Fetching (`[feat] Add model metadata fetching #9415`)

- File sizes fetched via HEAD requests (HuggingFace) and Civitai API with caching/deduplication
- Skeleton loader shown while metadata loads
- Gated repo support

**Test items**: open Model Library; select a model; verify metadata panel shows skeleton loader then populates with file size; verify caching (second open is faster).

### Exposed LiteGraph Internal Keybindings (`feat: expose litegraph internal keybindings #9459`)

- LiteGraph's internal keybindings now exposed in the keybindings settings panel

**Test items**: open Settings > Keybinding; verify LiteGraph keybindings (pan, zoom, etc.) visible in the table alongside ComfyUI keybindings.

### PostHog Telemetry Provider (`feat: add PostHog telemetry provider #9409`)

- PostHog analytics integration added

**Test items**: verify no console errors related to telemetry on page load; verify analytics events are fired correctly (network tab).

---

## Open Issues from Prior Reports

The following issues were identified in previous reports and should be re-verified:

### Issue 1 (from 2026-03-05): Missing i18n Translation — `menuLabels.Share`

- **Status**: Likely fixed — commit `55b8236c8 Fix localization on share and hide entry (#9395)` was merged after the Linux report and addresses share/hide localization.
- **Verify**: Open workflow actions menu — confirm "Share" displays as translated text, not `menuLabels.Share`.

### Issue 2 (from 2026-03-05): Settings Search Not Filtering

- **Status**: Unknown — no specific fix identified in commits. Re-test required.
- **Verify**: Open Settings → type "language" in search box → confirm filtering works.

### Issue 3 (both reports): Backend `KeyError: 'Unknown user: default'`

- **Status**: Backend issue, not frontend. No frontend fix expected.
- **Verify**: Still present in logs — informational.

### Issue 4 (both reports): `/nonexistent` Route Triggers File Download

- **Status**: Backend routing behavior, not a frontend SPA issue. No frontend fix expected.

### Issue 5 (from 2026-03-07): Persistent Pointer-Blocking Overlay After Concurrent Zoom Dropdown + Error Dialog

- **Status**: Unknown. Re-test required.
- **Steps**: Open zoom dropdown → trigger run error alert simultaneously → press Escape → verify no persistent `fixed inset-0` overlay remains.

### Issue 6 (from 2026-03-07): App Mode "Back to Workflow" Button Unreachable

- **Status**: Likely improved — commits `4ff14b5eb`, `7a01be388`, `1058b7d12` include multiple app mode fixes. Re-test required.
- **Verify**: Enter App Mode → verify "Back to workflow" / "Enter node graph" button is accessible at default viewport.

---

## Notes

- **Root Cause**: The Playwright MCP server (`npx @playwright/mcp@0.0.68`) is launched as a subprocess by the Claude CLI when the `--mcp-config` flag points to the JSON config file. In this execution, the agent was invoked without that config, so no `mcp__playwright__*` tools were injected. This is a CI workflow configuration issue — the agent must be launched via the `claude` CLI with the correct `--mcp-config` and `--allowedTools` flags as shown in `.github/workflows/qa-claude.yaml`.
- **Recommendation**: The CI workflow step "Run Claude QA" correctly configures the MCP server and tool allowlist. This report was produced by an agent invoked outside that workflow step.
- **Prior Coverage**: The Linux (2026-03-05) and macOS (2026-03-07) reports together cover the core application features. The major new features requiring re-test are the run controls redesign, workflow mode toggle, app mode improvements, and the share/publish flow.
- **Next Steps**: Re-run QA via the CI workflow on Windows to get browser-interactive results, or verify that the MCP config is passed correctly when invoking Claude for QA.
