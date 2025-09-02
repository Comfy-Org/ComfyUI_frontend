# Regenerating Load Audio Widget Test Expectations

## Overview
This document describes how to regenerate the Playwright test expectations for the "Can load audio" test in `browser_tests/tests/widget.spec.ts`.

## Prerequisites
1. ComfyUI backend running with `--multi-user` flag:
   ```bash
   python main.py --multi-user
   ```
2. ComfyUI_devtools installed in `custom_nodes` directory
3. Node.js dependencies installed (`pnpm install`)

## Steps to Regenerate

1. Ensure the backend is running on port 8188
2. Run the specific test with snapshot update flag:
   ```bash
   pnpm test:browser --update-snapshots tests/widget.spec.ts -g "Can load audio"
   ```

## Current Test Status
- Test location: `browser_tests/tests/widget.spec.ts:313`
- Snapshot location: `browser_tests/tests/widget.spec.ts-snapshots/load-audio-widget-chromium-linux.png`
- Workflow file: `browser_tests/assets/widgets/load_audio_widget.json`

## What the Test Does
The test loads a workflow containing a LoadAudio node and verifies that the audio widget renders correctly with:
- Audio player controls
- File upload button
- Proper node title and connections

## Note
The test snapshot needs to be regenerated when UI changes affect the LoadAudio node rendering.