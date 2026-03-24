---
name: reproduce-issue
description: 'Reproduce a GitHub issue by researching prerequisites, setting up the environment (custom nodes, workflows, settings), and interactively exploring ComfyUI via playwright-cli until the bug is confirmed. Then records a clean demo video.'
---

# Issue Reproduction Skill

Reproduce a reported GitHub issue against a running ComfyUI instance. This skill uses an interactive, agent-driven approach — not a static script. You will research, explore, retry, and adapt until the bug is reproduced, then record a clean demo.

## Architecture

Two videos are produced:

1. **Research video** — the full exploration session: installing deps, trying things, failing, retrying, figuring out the bug. Valuable for debugging context.
2. **Reproduce video** — a clean, minimal recording of just the reproduction steps. This is the demo you'd attach to the issue.

```
Phase 1: Research       → Read issue, understand prerequisites
Phase 2: Environment    → Install custom nodes, load workflows, configure settings
Phase 3: Explore        → [VIDEO 1: research] Interactively try to reproduce (retries OK)
Phase 4: Record         → [VIDEO 2: reproduce] Clean recording of just the minimal repro steps
Phase 5: Report         → Generate a structured reproduction report
```

## Prerequisites

- ComfyUI server running (ask user for URL, default: `http://127.0.0.1:8188`)
- `playwright-cli` installed: `npm install -g @playwright/cli@latest`
- `gh` CLI (authenticated, for reading issues)
- ComfyUI backend with Python environment (for installing custom nodes)

## Phase 1: Research the Issue

1. Fetch the issue details:
   ```bash
   gh issue view <number> --repo Comfy-Org/ComfyUI_frontend --json title,body,comments
   ```

2. Extract from the issue body:
   - **Reproduction steps** (the exact sequence)
   - **Prerequisites**: specific workflows, custom nodes, settings, models
   - **Environment**: OS, browser, ComfyUI version
   - **Media**: screenshots or videos showing the bug

3. Search the codebase for related code:
   - Find the feature/component mentioned in the issue
   - Understand how it works currently
   - Identify what state the UI needs to be in

## Phase 2: Environment Setup

Set up everything the issue requires BEFORE attempting reproduction.

### Custom Nodes

If the issue mentions custom nodes:

```bash
# Find the custom node repo
# Clone into ComfyUI's custom_nodes directory
cd <comfyui_path>/custom_nodes
git clone <custom_node_repo_url>

# Install dependencies if needed
cd <custom_node_name>
pip install -r requirements.txt 2>/dev/null || true

# Restart ComfyUI server to load the new nodes
```

### Workflows

If the issue references a specific workflow:

```bash
# Download workflow JSON if a URL is provided
curl -L "<workflow_url>" -o /tmp/test-workflow.json

# Load it via the API
curl -X POST http://127.0.0.1:8188/api/workflow \
  -H "Content-Type: application/json" \
  -d @/tmp/test-workflow.json
```

Or load via playwright-cli:
```bash
playwright-cli goto "http://127.0.0.1:8188"
# Drag-and-drop or use File > Open to load the workflow
```

### Settings

If the issue requires specific settings:
```bash
# Use playwright-cli to open settings and change them
playwright-cli press "Control+,"
playwright-cli snapshot
# Find and modify the relevant setting
```

## Phase 3: Interactive Exploration — Research Video

Start recording the **research video** (Video 1). This captures the full exploration — mistakes, retries, dead ends — all valuable context.

```bash
# Open browser and start video recording
playwright-cli open "http://127.0.0.1:8188"
playwright-cli video-start

# Take a snapshot to see current state
playwright-cli snapshot

# Interact based on what you see
playwright-cli click <ref>
playwright-cli fill <ref> "text"
playwright-cli press "Control+s"

# Check results
playwright-cli snapshot
playwright-cli screenshot --filename=/tmp/qa/research-step-1.png
```

### Key Principles

- **Observe before acting**: Always `snapshot` before interacting
- **Retry and adapt**: If a step fails, try a different approach
- **Document what works**: Keep notes on which steps trigger the bug
- **Don't give up**: Try multiple approaches if the first doesn't work
- **Establish prerequisites**: Many bugs require specific UI state:
  - Save a workflow first (File > Save)
  - Make changes to dirty the workflow
  - Open multiple tabs
  - Add specific node types
  - Change settings
  - Resize the window

### Common ComfyUI Interactions via playwright-cli

| Action | Command |
|--------|---------|
| Open hamburger menu | `playwright-cli click` on the C logo button |
| Navigate menu | `playwright-cli hover <ref>` then `playwright-cli click <ref>` |
| Add node | Double-click canvas → type node name → select from results |
| Connect nodes | Drag from output slot to input slot |
| Save workflow | `playwright-cli press "Control+s"` |
| Save As | Menu > File > Save As |
| Select node | Click on the node |
| Delete node | Select → `playwright-cli press "Delete"` |
| Right-click menu | `playwright-cli click <ref> --button right` |
| Keyboard shortcut | `playwright-cli press "Control+z"` |

## Phase 4: Record Clean Demo — Reproduce Video (max 5 minutes)

Once the bug is confirmed, **stop the research video** and **close the research browser**:
```bash
playwright-cli video-stop
playwright-cli close
```

Now start a **fresh browser session** for the clean reproduce video (Video 2).

**IMPORTANT constraints:**
- **Max 5 minutes** — the reproduce video must be short and focused
- **No environment setup** — server, user, custom nodes are already set up from Phase 3. Just log in and go.
- **No exploration** — you already know the exact steps. Execute them quickly and precisely.
- **Start video recording immediately**, execute steps, stop. Don't leave the recording running while thinking.

1. **Open browser and start recording**:
   ```bash
   playwright-cli open "http://127.0.0.1:8188"
   playwright-cli video-start
   ```

2. **Execute only the minimal reproduction steps** — no exploration, no mistakes. Just the clean sequence that demonstrates the bug. You already know exactly what works from Phase 3.

3. **Take key screenshots** at critical moments:
   ```bash
   playwright-cli screenshot --filename=/tmp/qa/before-bug.png
   # ... trigger the bug ...
   playwright-cli screenshot --filename=/tmp/qa/bug-visible.png
   ```

4. **Stop recording and close** immediately after the bug is demonstrated:
   ```bash
   playwright-cli video-stop
   playwright-cli close
   ```

## Phase 5: Generate Report

Create a reproduction report at `tmp/qa/reproduce-report.md`:

```markdown
# Issue Reproduction Report

- **Issue**: <issue_url>
- **Title**: <issue_title>
- **Date**: <today>
- **Status**: Reproduced / Not Reproduced / Partially Reproduced

## Environment

- ComfyUI Server: <url>
- OS: <os>
- Custom Nodes Installed: <list or "none">
- Settings Changed: <list or "none">

## Prerequisites

List everything that had to be set up before the bug could be triggered:

1. ...
2. ...

## Reproduction Steps

Minimal steps to reproduce (the clean sequence):

1. ...
2. ...
3. ...

## Expected Behavior

<from the issue>

## Actual Behavior

<what actually happened>

## Evidence

- Research video: `research-video/video.webm` (full exploration session)
- Reproduce video: `reproduce-video/video.webm` (clean minimal repro)
- Screenshots: `before-bug.png`, `bug-visible.png`

## Root Cause Analysis (if identified)

<code pointers, hypothesis about what's going wrong>

## Notes

<any additional observations, workarounds discovered, related issues>
```

## Handling Failures

If the bug **cannot be reproduced**:

1. Document what you tried and why it didn't work
2. Check if the issue was already fixed (search git log for related commits)
3. Check if it's environment-specific (OS, browser, specific version)
4. Set report status to "Not Reproduced" with detailed notes
5. The report is still valuable — it saves others from repeating the same investigation

## CI Integration

In CI, this skill runs as a Claude Code agent with:
- `ANTHROPIC_API_KEY` for Claude
- `GEMINI_API_KEY` for initial issue analysis (optional)
- ComfyUI server pre-started in the container
- `playwright-cli` pre-installed

The CI workflow:
1. Gemini generates a reproduce guide (markdown) from the issue
2. Claude agent receives the guide and runs this skill
3. Claude explores interactively, installs dependencies, retries
4. Claude records a clean demo once reproduced
5. Video and report are uploaded as artifacts
