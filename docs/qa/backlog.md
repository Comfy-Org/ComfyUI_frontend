# QA Pipeline Backlog

## Comparison Modes

### Type A: Same code, different settings (IMPLEMENTED)

Agent demonstrates both working (control) and broken (test) states in one session by toggling settings. E.g., Nodes 2.0 OFF → drag works, Nodes 2.0 ON → drag broken.

### Type B: Different commits

For regressions reported as "worked in vX.Y, broken in vX.Z":

- `qa-analyze-pr.ts` detects regression markers ("since v1.38", "after PR #1234")
- Pipeline checks out the old commit, records control video
- Records test video on current main
- Side-by-side comparison on report page (reuses PR before/after infra)

### Type C: Different browsers

For browser-specific bugs ("works on Chrome, broken on Firefox"):

- Run recording with different Playwright browser contexts
- Compare behavior across browsers in one report

## Agent Improvements

### TTS Narration

- OpenAI TTS (`tts-1`, nova voice) generates audio from agent reasoning
- Merged into video via ffmpeg at correct timestamps
- Currently in qa-record.ts but needs wiring into hybrid agent path

### Image/Screenshot Reading

- `qa-analyze-pr.ts` already downloads and sends images from issue bodies to Gemini
- Could also send them to the Claude agent as context ("the reporter showed this screenshot")

### Placeholder Page

- Deploy a status page immediately when CI starts
- Auto-refreshes every 30s until final report replaces it
- Shows spinner, CI link, badge

### Pre-seed Assets

- Upload test images via ComfyUI API before recording
- Enables reproduction of bugs requiring assets (#10424 zoom button)

### Environment-Dependent Issues

- #7942: needs custom TestNode — could install a test custom node pack in CI
- #9101: needs completed generation — could run with a tiny model checkpoint

## Cost Optimization

### Lazy A11y Tree

- `inspect(selector)` searches tree for specific element (~20 tokens)
- `getUIChanges()` diffs against previous snapshot (~100 tokens)
- vs dumping full tree every turn (~2000 tokens)

### Gemini Video vs Images

- 30s video clip: ~7,700 tokens (258 tok/s)
- 15 screenshots: ~19,500 tokens (1,300 tok/frame)
- Video is 2.5x cheaper and shows temporal changes

### Model Selection

- Claude Sonnet 4.6: $3/$15 per 1M in/out — best reasoning
- Gemini 2.5 Flash: $0.10/$0.40 per 1M — best vision-per-dollar
- Hybrid uses each where it's strongest
