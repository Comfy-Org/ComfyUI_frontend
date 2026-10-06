# ComfyUI DevTools

This directory contains development tools and test utilities for ComfyUI, previously maintained as a separate repository at `https://github.com/Comfy-Org/ComfyUI_devtools`.

## Contents

- `__init__.py` - Server endpoints for development tools (`/api/devtools/*`)
- `dev_nodes.py` - Development and testing nodes for ComfyUI
- `fake_model.safetensors` - Test fixture for model loading tests

## Purpose

These tools provide:

- Test endpoints for browser automation
- Development nodes for testing various UI features
- Mock data for consistent testing environments

## Usage

During CI/CD, these files are automatically copied to the ComfyUI `custom_nodes` directory. For local development, copy these files to your ComfyUI installation:

```bash
cp -r tools/devtools/* /path/to/your/ComfyUI/custom_nodes/ComfyUI_devtools/
```

## DynamicGroup contract test

`Node With Dynamic Group` repeats a LoRA-shaped widget template and returns its
received rows as JSON. It does not load models. Connect its output to Preview as
Text. Enable Modern Node Design (Node 2.0) to edit its dynamic rows; legacy
canvas shows one Node 2.0-only notice per group instead of editable controls.

This test-only node imports the unstable internal `_DynamicGroup` implementation
from [ComfyUI #16811](https://github.com/Comfy-Org/ComfyUI/pull/16811).
Backends without that internal class do not register it. The browser scenarios in
[`dynamicGroup.spec.ts`](../../browser_tests/tests/vueNodes/widgets/dynamicGroup.spec.ts)
use real `/object_info`, workflow storage and execution. Run them with
`pnpm exec playwright test --config=playwright.dynamic-group.config.ts`.

The dedicated `playwright-tests-dynamic-group` CI job records videos and pins
the backend to commit `73867fdf33c428f7a4bd7d632c22ca28373d8836`.
Other E2E jobs use the standard CI image's backend. Once that image includes
the internal DynamicGroup implementation, remove the dedicated checkout and
dependency installation, and use the shared server startup action in this job.

## Migration

This directory was created as part of issue #4683 to merge the ComfyUI_devtools repository into the main frontend repository, eliminating the need for separate versioning and simplifying the development workflow.
