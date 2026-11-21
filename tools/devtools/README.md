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
use real `/object_info`, workflow storage and execution, and run in the regular
E2E shards against the CI image's backend.

## Migration

This directory was created as part of issue #4683 to merge the ComfyUI_devtools repository into the main frontend repository, eliminating the need for separate versioning and simplifying the development workflow.

## Node menu compatibility fixtures

The menu extension reproduces reduced custom-node menu additions against the
real frontend. It contains no substitute core producer, converter, or renderer.
Synthetic removal, reordering, and complete-override probes belong to the
Playwright tests rather than the devtools extension.

- [Custom Scripts SwapResolution](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/609f3afaa74b2f88ef9ce8d939626065e3247469/web/js/swapResolution.js)
  wraps the previous node hook, swaps the actual width and height widgets, and
  returns the previous hook's result. The fixture adds an explicit closure-only
  declaration so the same action can use Vue presentation.
- [Custom Scripts NodeFinder](https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/609f3afaa74b2f88ef9ce8d939626065e3247469/web/js/nodeFinder.js)
  groups graph nodes by type, orders them by horizontal position, and centers
  the chosen node through nested declarative menus. The original wraps the
  canvas menu; the fixture applies this addition to the node menu to exercise
  its compatibility boundary. Execution-following features are not reproduced.
- [rgthree Connections Layout and menu helper](https://github.com/rgthree/rgthree-comfy/blob/bc48c6aaeca87bedbc14245d89f9bc6be37a630e/web/comfyui/utils.js)
  inserts a submenu after Shape, opens a real native menu with the supplied
  event and parent, and writes the selected `connections_layout` property.
  The fixture preserves that imperative callback and global child-menu callback.
  It does not reproduce rgthree's connection-position renderer overrides.

These are attributed adaptations, not copies of complete extensions. Passing
their browser scenarios does not establish compatibility with those packages
as a whole.
