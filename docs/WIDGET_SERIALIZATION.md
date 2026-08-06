# Widget Serialization Controls

Two properties named `serialize` and the related `syncToWorkflow` property control different serialization layers.

**`widget.serialize`** — Controls **workflow persistence**. Checked by `LGraphNode.serialize()` and `configure()` when reading/writing `widgets_values` in the workflow JSON. When `false`, the widget is skipped in both serialization and deserialization. Used for UI-only widgets (image previews, progress text, audio players). Typed as `IBaseWidget.serialize` in `src/lib/litegraph/src/types/widgets.ts`.

**`widget.options.serialize`** — Controls **prompt/API serialization**. Checked by `executionUtil.ts` when building the API payload sent to the backend. When `false`, the widget is excluded from prompt inputs. Used for client-side-only controls (`control_after_generate`, combo filter lists) that the server doesn't need. Typed as `IWidgetOptions.serialize` in `src/lib/litegraph/src/types/widgets.ts`.

**`widget.syncToWorkflow`** — Controls whether an explicit `widget.serializeValue()` result is copied into the execution workflow snapshot returned by `graphToPrompt()` and embedded in output metadata. It defaults to `true`. This does not mutate the live widget value or change workflow persistence through a normal `graph.serialize()` call.

The two `serialize` properties correspond to the two data formats in `ComfyMetadata` embedded in output files (PNG, GLTF, WebM, AVIF, etc.): `widget.serialize` → `ComfyMetadataTags.WORKFLOW`, `widget.options.serialize` → `ComfyMetadataTags.PROMPT`.

## Execution workflow synchronization

`graphToPrompt()` first serializes the graph, then resolves widget values for execution. For widgets with an explicit `serializeValue()`, the resolved value is copied into that serialized execution snapshot by default. Set `syncToWorkflow = false` when the transform is only meaningful for the current execution.

For example, `saveImageExtraOutput` keeps a `filename_prefix` template such as `ComfyUI_%date:yyyy-MM-dd%` in the workflow while sending a resolved value such as `ComfyUI_2026-07-24` in the prompt:

```ts
widget.serializeValue = () =>
  typeof widget.value === 'string'
    ? applyTextReplacements(app.graph, widget.value)
    : widget.value
widget.syncToWorkflow = false
```

Snapshot synchronization respects the existing `widgets_values` shape:

- Array-based `widgets_values` are updated by widget index.
- VHS-style record-based `widgets_values` are updated only when an existing key matches the widget name. Unrelated keys are preserved, and missing widget-name keys are not added.

## Permutation table

| `widget.serialize` | `widget.options.serialize` | In workflow? | In prompt? | Examples                                                             |
| ------------------ | -------------------------- | ------------ | ---------- | -------------------------------------------------------------------- |
| ✅ default         | ✅ default                 | Yes          | Yes        | seed, cfg, sampler_name                                              |
| ✅ default         | ❌ false                   | Yes          | No         | control_after_generate, combo filter list                            |
| ❌ false           | ✅ default                 | No           | Yes        | No current usage (would be a transient value computed at queue time) |
| ❌ false           | ❌ false                   | No           | No         | Image/video previews, audio players, progress text                   |

## Gotchas

- `addWidget('combo', name, value, cb, { serialize: false })` puts `serialize` into `widget.options`, **not** onto `widget` directly. These are different properties consumed by different systems.
- `LGraphNode.serialize()` checks `widget.serialize === false`. It does **not** check `widget.options.serialize`. A widget with `options.serialize = false` is still included in `widgets_values`.
- `LGraphNode.serialize()` only writes `widgets_values` if `this.widgets` is truthy. Nodes that create widgets dynamically (like `PrimitiveNode`) will have no `widgets_values` in serialized output if serialized before widget creation — even if `this.widgets_values` exists on the instance from a prior `configure()` call.
- `widget.options.serialize` is typed as `IWidgetOptions.serialize` — both properties share the name `serialize` but live at different levels of the widget object.
- `widget.syncToWorkflow` has no effect unless the widget defines `serializeValue()`.

## PrimitiveNode and copy/paste

`PrimitiveNode` creates widgets dynamically on connection — it starts as an empty polymorphic node and morphs to match its target widget in `_onFirstConnection()`. This interacts badly with the copy/paste pipeline.

### The clone→serialize gap

`LGraphCanvas._serializeItems()` copies nodes via `item.clone()?.serialize()` (line 3911). For PrimitiveNode this fails:

1. `clone()` calls `this.serialize()` on the **original** node (which has widgets, so `widgets_values` is captured correctly).
2. `clone()` creates a **fresh** PrimitiveNode via `LiteGraph.createNode()` and calls `configure(data)` on it — this stores `widgets_values` on the instance.
3. But the fresh PrimitiveNode has no `this.widgets` (widgets are created only on connection), so when `serialize()` is called on the clone, `LGraphNode.serialize()` skips the `widgets_values` block entirely (line 964: `if (widgets && this.serialize_widgets)`).

Result: `widgets_values` is silently dropped from the clipboard data.

### Why seed survives but control_after_generate doesn't

When the pasted PrimitiveNode reconnects to the pasted target node, `_createWidget()` copies `theirWidget.value` from the target (line 254). This restores the **primary** widget value (e.g., `seed`).

But `control_after_generate` is a **secondary** widget created by `addValueControlWidgets()`, which reads its initial value from `this.widgets_values?.[1]` (line 263). That value was lost during clone→serialize, so it falls back to `'fixed'` (line 265).

See [ADR-0006](adr/0006-primitive-node-copy-paste-lifecycle.md) for proposed fixes and design tradeoffs.

## Code references

- `widget.serialize` checked: `src/lib/litegraph/src/LGraphNode.ts` serialize() and configure()
- `widget.options.serialize` checked: `src/utils/executionUtil.ts`
- `widget.syncToWorkflow` checked: `src/utils/executionUtil.ts`
- `widget.options.serialize` set: `src/scripts/widgets.ts` addValueControlWidgets()
- `widget.syncToWorkflow` set: `src/extensions/core/saveImageExtraOutput.ts`
- `widget.serialize` set: `src/composables/node/useNodeImage.ts`, `src/extensions/core/previewAny.ts`, etc.
- Metadata types: `src/types/metadataTypes.ts`
- PrimitiveNode: `src/extensions/core/widgetInputs.ts`
- Copy/paste serialization: `src/lib/litegraph/src/LGraphCanvas.ts` `_serializeItems()`
- Clone: `src/lib/litegraph/src/LGraphNode.ts` `clone()`
