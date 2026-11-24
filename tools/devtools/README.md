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

## Try widget augmentation

ComfyUI loads the example from `web/widgetAugmentations.js`. Restart ComfyUI and reload the frontend. Add **Node With Augmented Textarea**.
Type `studio` in **prompt** to open suggestions, then press Enter to insert one.
Press Undo to restore the query. The **notes** field has no extension suggestions.
With Nodes 2.0 enabled, expand **prompt** and try the same query in the dialog.
The live hint counts prompt tags. Enter `blue_eyes ; soft_focus`, then click
**Normalize tags** to produce `blue eyes, soft focus`. Undo restores the original.

The example declares `widgetAugmentations` through `app.registerExtension`.
Each contribution has an extension-scoped `id`, a `target`, and a `kind`. A
`target` is either an exact `{ nodeType, widgetName }` or a predicate that
receives that pair and returns `true` for each widget it augments.
The kinds are:

- `text-completion` supplies synchronous suggestions through `suggest(query)`.
- `hint` returns plain text from the current widget value through `text(value)`.
- `text-action` supplies a button `label` and a synchronous `transform(value)`
  returning the replacement text.
- `path-completion` supplies asynchronous `suggest(value, { signal,
  showAllFiles, widget })` results and `parent(value)` navigation. Results distinguish
  directory and file entries from an unavailable listing.

Core renders contributions, isolates callback failures, honors extension
enablement, and removes contributions when an extension unregisters. Text edits
use the normal input pipeline and native undo. Read-only, disabled, composing,
stale, and over-length edits are refused. There is no direct-value fallback
when native insertion is unsupported.

The prototype supports multiline native textareas in both node renderers and
the expanded editor. It does not expose widget elements, callbacks, arbitrary
mounting, or a generic value setter. It does not augment canvas-painted controls
or the ProseMirror agent editor. Register immutable contributions; replace the
extension registration rather than mutating an installed contribution.

The Vite development server does not load backend extension scripts. To try the
example there, register its exported `extension` through
`app.registerExtension` after startup.

### Try path completion

Enable Nodes 2.0 and add **Node With Path Completion** and **Node With Image
Path Completion**. One registration covers both, the way VideoHelperSuite could
cover all of its path nodes. Its predicate matches `path` and `image` widgets on
node types ending in `PathCompletion`. **notes** is a neighboring, unaugmented
single-line field.

1. Click **path**, initially `/media/`, to open the draft editor and wait for the listing.
   The directory `clips/` and `.mp4` files appear. Select `clips/` to
   navigate to `/media/clips/`, then use parent navigation to return.
2. Focus the draft and use arrow keys and Tab to fill a suggestion without
   confirming. Native undo restores the previous draft. Clicking a file
   confirms it; workflow undo restores the previous widget value. Core inserts
   punctuation as typed. Type quickly to exercise cancellation of stale requests.
3. Return to `/media/` and enable **Show all files** to reveal `notes.txt`.
   Disable it to restrict files to `.mp4` again; directories remain visible.
4. Enter `/unavailable/` and retry the listing. It stays unavailable by design;
   enter `/unavailable/manual.mp4` manually and select **Confirm**. Suggestions
   never validate the path. `/media/missing` instead has a ready,
   empty listing.
5. In **image**, open `/images/`. The same provider lists `portrait.png` and
   hides `intro.mp4`, because it filters by the widget it serves.
6. Type `/media/` in **notes** and confirm no path suggestions appear. In the
   legacy canvas renderer, **path** stays a plain manual widget.

This example uses a deterministic in-memory directory tree, not the backend
filesystem or a VHS endpoint. Aborted requests clear their timer and listener;
completed requests release the listener. Path completion currently hosts only
native single-line STRING widgets in Vue Nodes 2.0, not legacy canvas widgets
or multiline textareas. The textarea example above works in both renderers.

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
