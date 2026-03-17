---
name: comfy-qa
description: 'Comprehensive QA of ComfyUI frontend. Navigates all routes, tests all interactive features using playwright-cli, generates a report, and submits a draft PR. Works in CI and local environments, cross-platform.'
---

# ComfyUI Frontend QA Skill

Perform comprehensive quality assurance of the ComfyUI frontend application by navigating all routes, clicking interactive elements, and testing features. Generate a structured report and submit it as a draft PR.

## Prerequisites

- Node.js 18+
- `pnpm` package manager
- `gh` CLI (authenticated)
- `playwright-cli` (browser automation): `npm install -g @playwright/cli@latest`

## Step 1: Environment Detection & Setup

Detect the runtime environment and ensure the app is accessible.

### CI Environment

If `CI=true` is set:

1. The ComfyUI backend is pre-configured in the CI container (`ghcr.io/comfy-org/comfyui-ci-container`)
2. Frontend dist is already built and served by the backend
3. Server runs at `http://127.0.0.1:8188`
4. Skip user prompts — run fully automated

### Local Environment

If `CI` is not set:

1. **Ask the user**: "Is a ComfyUI server already running? If so, what URL? (default: http://127.0.0.1:8188)"
   - If yes: use the provided URL
   - If no: offer to start one:

     ```bash
     # Option A: Use existing ComfyUI installation
     # Ask for the path to ComfyUI, then:
     cd <comfyui_path>
     python main.py --cpu --multi-user --front-end-root <frontend_dist_path> &

     # Option B: Build frontend and use preview server (no backend features)
     pnpm build && pnpm preview &
     ```

2. Wait for server readiness by polling the URL (retry with 2s intervals, 60s timeout)

### Browser Automation Setup

Use **playwright-cli** for browser interaction via Bash commands:

```bash
playwright-cli open http://127.0.0.1:8188   # open browser and navigate
playwright-cli snapshot                      # capture snapshot with element refs
playwright-cli click e1                      # click by element ref from snapshot
playwright-cli press Tab                     # keyboard shortcuts
playwright-cli screenshot --filename=f.png  # save screenshot
```

playwright-cli is headless by default (CI-friendly). Each command outputs the current page snapshot with element references (`e1`, `e2`, …) that you use for subsequent `click`, `fill`, `hover` commands. Always run `snapshot` before interacting to get fresh refs.

For local dev servers behind proxies, adjust the URL accordingly (e.g., `https://[port].stukivx.xyz` pattern if configured).

## Step 2: QA Test Plan

Navigate to the application URL and systematically test each area below. For each test, record:

- **Status**: pass / fail / skip (with reason)
- **Notes**: any issues, unexpected behavior, or visual glitches
- **Screenshots**: take screenshots of failures or notable states

### 2.1 Application Load & Routes

| Test              | Steps                                                        |
| ----------------- | ------------------------------------------------------------ |
| Root route loads  | Navigate to `/` — GraphView should render with canvas        |
| User select route | Navigate to `/user-select` — user selection UI should appear |
| Default redirect  | If multi-user mode, `/` redirects to `/user-select` first    |
| 404 handling      | Navigate to `/nonexistent` — should handle gracefully        |

### 2.2 Canvas & Graph View

| Test                      | Steps                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Canvas renders            | The LiteGraph canvas is visible and interactive                |
| Pan canvas                | Click and drag on empty canvas area                            |
| Zoom in/out               | Use scroll wheel or Alt+=/Alt+-                                |
| Fit view                  | Press `.` key — canvas fits to content                         |
| Add node via double-click | Double-click canvas to open search, type "KSampler", select it |
| Add node via search       | Open search box, find and add a node                           |
| Delete node               | Select a node, press Delete key                                |
| Connect nodes             | Drag from output slot to input slot                            |
| Disconnect nodes          | Right-click a link and remove, or drag from connected slot     |
| Multi-select              | Shift+click or drag-select multiple nodes                      |
| Copy/Paste                | Select nodes, Ctrl+C then Ctrl+V                               |
| Undo/Redo                 | Make changes, Ctrl+Z to undo, Ctrl+Y to redo                   |
| Node context menu         | Right-click a node — menu appears with all expected options    |
| Canvas context menu       | Right-click empty canvas — menu appears                        |

### 2.3 Node Operations

| Test                | Steps                                                      |
| ------------------- | ---------------------------------------------------------- |
| Bypass node         | Select node, Ctrl+B — node shows bypass state              |
| Mute node           | Select node, Ctrl+M — node shows muted state               |
| Collapse node       | Select node, Alt+C — node collapses                        |
| Pin node            | Select node, press P — node becomes pinned                 |
| Rename node         | Double-click node title — edit mode activates              |
| Node color          | Right-click > Color — color picker works                   |
| Group nodes         | Select multiple nodes, Ctrl+G — group created              |
| Ungroup             | Right-click group > Ungroup                                |
| Widget interactions | Toggle checkboxes, adjust sliders, type in text fields     |
| Combo widget        | Click dropdown widgets — options appear and are selectable |

### 2.4 Sidebar Tabs

| Test                   | Steps                                                  |
| ---------------------- | ------------------------------------------------------ |
| Workflows tab          | Press W — workflows sidebar opens with saved workflows |
| Node Library tab       | Press N — node library opens with categories           |
| Model Library tab      | Press M — model library opens                          |
| Assets tab             | Press A — assets browser opens                         |
| Tab toggle             | Press same key again — sidebar closes                  |
| Search in sidebar      | Type in search box — results filter                    |
| Drag node from library | Drag a node from library onto canvas                   |

### 2.5 Topbar & Workflow Tabs

| Test                 | Steps                                                  |
| -------------------- | ------------------------------------------------------ |
| Workflow tab display | Current workflow name shown in tab bar                 |
| New workflow         | Ctrl+N — new blank workflow created                    |
| Rename workflow      | Double-click workflow tab                              |
| Tab context menu     | Right-click workflow tab — menu with Close/Rename/etc. |
| Multiple tabs        | Open multiple workflows, switch between them           |
| Queue button         | Click Queue/Run button — prompt queues                 |
| Batch count          | Click batch count editor, change value                 |
| Menu hamburger       | Click hamburger menu — options appear                  |

### 2.6 Settings Dialog

| Test             | Steps                                                |
| ---------------- | ---------------------------------------------------- |
| Open settings    | Press Ctrl+, or click settings button                |
| Settings tabs    | Navigate through all setting categories              |
| Change a setting | Toggle a boolean setting — it persists after closing |
| Search settings  | Type in settings search box — results filter         |
| Keybindings tab  | Navigate to keybindings panel                        |
| About tab        | Navigate to about panel — version info shown         |
| Close settings   | Press Escape or click close button                   |

### 2.7 Bottom Panel

| Test                | Steps                                  |
| ------------------- | -------------------------------------- |
| Toggle panel        | Press Ctrl+` — bottom panel opens      |
| Logs tab            | Logs/terminal tab shows server output  |
| Shortcuts tab       | Shortcuts reference is displayed       |
| Keybindings display | Press Ctrl+Shift+K — keybindings panel |

### 2.8 Execution & Queue

| Test           | Steps                                                 |
| -------------- | ----------------------------------------------------- |
| Queue prompt   | Load default workflow, click Queue — execution starts |
| Queue progress | Progress indicator shows during execution             |
| Interrupt      | Press Ctrl+Alt+Enter during execution — interrupts    |
| Job history    | Open job history sidebar — past executions listed     |
| Clear history  | Clear execution history via menu                      |

### 2.9 Workflow File Operations

| Test            | Steps                                             |
| --------------- | ------------------------------------------------- |
| Save workflow   | Ctrl+S — workflow saves (check for prompt if new) |
| Open workflow   | Ctrl+O — file picker or workflow browser opens    |
| Export JSON     | Menu > Export — workflow JSON downloads           |
| Import workflow | Drag a .json workflow file onto canvas            |
| Load default    | Menu > Load Default — default workflow loads      |
| Clear workflow  | Menu > Clear — canvas clears (after confirmation) |

### 2.10 Advanced Features

| Test            | Steps                                             |
| --------------- | ------------------------------------------------- |
| Minimap         | Alt+M — minimap toggle                            |
| Focus mode      | Toggle focus mode                                 |
| Canvas lock     | Press H to lock, V to unlock                      |
| Link visibility | Ctrl+Shift+L — toggle links                       |
| Subgraph        | Select nodes > Ctrl+Shift+E — convert to subgraph |

### 2.11 Error Handling

| Test                  | Steps                                        |
| --------------------- | -------------------------------------------- |
| Missing nodes dialog  | Load workflow with non-existent node types   |
| Missing models dialog | Trigger missing model warning                |
| Network error         | Disconnect backend, verify graceful handling |
| Invalid workflow      | Try loading malformed JSON                   |

### 2.12 Responsive & Accessibility

| Test                | Steps                                 |
| ------------------- | ------------------------------------- |
| Window resize       | Resize browser window — layout adapts |
| Keyboard navigation | Tab through interactive elements      |
| Sidebar resize      | Drag sidebar edge to resize           |

## Step 3: Generate Report

After completing all tests, generate a markdown report file.

### Report Location

```
docs/qa/YYYY-MM-DD-NNN-report.md
```

Where:

- `YYYY-MM-DD` is today's date
- `NNN` is a zero-padded increment index (001, 002, etc.)

To determine the increment, check existing files:

```bash
ls docs/qa/ | grep "$(date +%Y-%m-%d)" | wc -l
```

### Report Template

```markdown
# QA Report: ComfyUI Frontend

**Date**: YYYY-MM-DD
**Environment**: CI / Local (OS, Browser)
**Frontend Version**: (git sha or version)
**Agent**: Claude / Codex / Other
**Server URL**: http://...

## Summary

| Category        | Pass | Fail | Skip | Total |
| --------------- | ---- | ---- | ---- | ----- |
| Routes & Load   |      |      |      |       |
| Canvas          |      |      |      |       |
| Node Operations |      |      |      |       |
| Sidebar         |      |      |      |       |
| Topbar          |      |      |      |       |
| Settings        |      |      |      |       |
| Bottom Panel    |      |      |      |       |
| Execution       |      |      |      |       |
| File Operations |      |      |      |       |
| Advanced        |      |      |      |       |
| Error Handling  |      |      |      |       |
| Responsive      |      |      |      |       |
| **Total**       |      |      |      |       |

## Results

### Routes & Load

- [x] Root route loads — pass
- [ ] ...

### Canvas & Graph View

- [x] Canvas renders — pass
- [ ] ...

(repeat for each category)

## Issues Found

### Issue 1: [Title]

- **Severity**: critical / major / minor / cosmetic
- **Steps to reproduce**: ...
- **Expected**: ...
- **Actual**: ...
- **Screenshot**: (if available)

## Notes

Any additional observations, performance notes, or suggestions.
```

## Step 4: Commit and Push Report

### In CI (when `CI=true`)

Save the report directly to `$QA_ARTIFACTS` (the CI workflow uploads this as
an artifact and posts results as a PR comment). Do **not** commit, push, or
create a new PR.

### Local / interactive use

When running locally, create a draft PR after committing:

```bash
# Ensure on a feature branch
BRANCH_NAME="qa/$(date +%Y-%m-%d)-$(git rev-parse --short HEAD)"
git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

git add docs/qa/
git commit -m "docs: add QA report $(date +%Y-%m-%d)

Automated QA report covering all frontend routes and features."
git push -u origin "$BRANCH_NAME"

# Create draft PR assigned to comfy-pr-bot
gh pr create \
  --draft \
  --title "QA Report: $(date +%Y-%m-%d)" \
  --body "## QA Report

Automated frontend QA run covering all routes and interactive features.

See \`docs/qa/\` for the full report.

/cc @comfy-pr-bot" \
  --assignee comfy-pr-bot
```

## Execution Notes

### Cross-Platform Considerations

- **Windows**: Use `pwsh` or `cmd` equivalents for shell commands. `gh` CLI works on all platforms.
- **macOS**: Keyboard shortcuts use Cmd instead of Ctrl in the actual app, but Playwright sends OS-appropriate keys.
- **Linux**: Primary CI platform. Screenshot baselines are Linux-only.

### Agent Compatibility

This skill uses **playwright-cli** (`@playwright/cli`) — a token-efficient CLI designed for coding agents. Install it once with `npm install -g @playwright/cli@latest`, then use `Bash` to run commands.

The key operations and their playwright-cli equivalents:

| Action           | Command                                    |
| ---------------- | ------------------------------------------ |
| Navigate to URL  | `playwright-cli goto <url>`                |
| Get element refs | `playwright-cli snapshot`                  |
| Click element    | `playwright-cli click <ref>`               |
| Type text        | `playwright-cli fill <ref> <text>`         |
| Press shortcut   | `playwright-cli press <key>`               |
| Take screenshot  | `playwright-cli screenshot --filename=f`   |
| Hover element    | `playwright-cli hover <ref>`               |
| Select dropdown  | `playwright-cli select <ref> <value>`      |

Snapshots return element references (`e1`, `e2`, …). Always run `snapshot` after navigation or major interactions to refresh refs before acting.

### Tips for Reliable QA

1. **Wait for page stability** before interacting — check that elements are visible and enabled
2. **Take a snapshot after each major navigation** to verify state
3. **Don't use fixed timeouts** — poll for expected conditions
4. **Record the full page snapshot** at the start for baseline comparison
5. **If a test fails**, document it and continue — don't abort the entire QA run
6. **Group related tests** — complete one category before moving to the next
