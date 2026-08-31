# Widget Serialization: `widget.serialize` vs `widget.options.serialize`

Two properties named `serialize` exist at different levels of a widget object. They control different serialization layers and are checked by completely different code paths.

**`widget.serialize`** — Controls **workflow persistence**. Checked by `LGraphNode.serialize()` and `configure()` when reading/writing `widgets_values` in the workflow JSON. When `false`, the widget is skipped in both serialization and deserialization. Used for UI-only widgets (image previews, progress text, audio players). Typed as `IBaseWidget.serialize` in `src/lib/litegraph/src/types/widgets.ts`.

**`widget.options.serialize`** — Controls **prompt/API serialization**. Checked by `executionUtil.ts` when building the API payload sent to the backend. When `false`, the widget is excluded from prompt inputs. Used for client-side-only controls (`control_after_generate`, combo filter lists) that the server doesn't need. Typed as `IWidgetOptions.serialize` in `src/lib/litegraph/src/types/widgets.ts`.

These correspond to the two data formats in `ComfyMetadata` embedded in output files (PNG, GLTF, WebM, AVIF, etc.): `widget.serialize` → `ComfyMetadataTags.WORKFLOW`, `widget.options.serialize` → `ComfyMetadataTags.PROMPT`.

## Permutation table

| `widget.serialize` | `widget.options.serialize` | In workflow? | In prompt? | Examples                                                             |
| ------------------ | -------------------------- | ------------ | ---------- | -------------------------------------------------------------------- |
| ✅ default         | ✅ default                 | Yes          | Yes        | seed, cfg, sampler_name                                              |
| ✅ default         | ❌ false                   | Yes          | No         | control_after_generate, combo filter list                            |
| ❌ false           | ✅ default                 | No           | Yes        | No current usage (would be a transient value computed at queue time) |
| ❌ false           | ❌ false                   | No           | No         | Image/video previews, audio players, progress text                   |

## Gotchas

- `addWidget('combo', name, value, cb, { serialize: false })` puts `serialize` into `widget.options`, **not** onto `widget` directly. These are different properties consumed by different systems.
- `LGraphNode.serialize()` checks `widget.serialize === false` (in its `serialiseWidgetValues()` helper). It does **not** check `widget.options.serialize`. A widget with `options.serialize = false` is still included in `widgets_values`.
- `LGraphNode.serialize()` only writes `widgets_values` if `this.widgets` is non-empty (`widgets?.length && this.serialize_widgets`). Nodes that create widgets dynamically (like `PrimitiveNode`) will have no `widgets_values` in serialized output if serialized before widget creation — even if `this.widgets_values` exists on the instance from a prior `configure()` call.
- `widget.options.serialize` is typed as `IWidgetOptions.serialize` — both properties share the name `serialize` but live at different levels of the widget object.

## PrimitiveNode and copy/paste

`PrimitiveNode` creates widgets dynamically on connection — it starts as an empty polymorphic node and morphs to match its target widget in `_onFirstConnection()`. This interacts badly with the copy/paste pipeline.

### The clone→serialize gap

`LGraphCanvas._serializeItems()` copies nodes via `item.clone()?.serialize()`. For PrimitiveNode this fails:

1. `clone()` calls `this.serialize()` on the **original** node (which has widgets, so `widgets_values` is captured correctly).
2. `clone()` creates a **fresh** PrimitiveNode via `LiteGraph.createNode()` and calls `configure(data)` on it — this stores `widgets_values` on the instance.
3. But the fresh PrimitiveNode has no `this.widgets` (widgets are created only on connection), so when `serialize()` is called on the clone, `LGraphNode.serialize()` skips the `widgets_values` block entirely (`if (widgets?.length && this.serialize_widgets)`).

Result: `widgets_values` is silently dropped from the clipboard data.

### Why seed survives but control_after_generate doesn't

When the pasted PrimitiveNode reconnects to the pasted target node, `_createWidget()` copies `theirWidget.value` from the target. This restores the **primary** widget value (e.g., `seed`).

But `control_after_generate` is a **secondary** widget. `_createWidget()` looks up its initial value with `useWidgetValueStore().getPositionalRestoredWidgetValue(graphId, this.id, 1)` before handing it to `addValueControlWidgets()`. The positional value at index 1 was lost during clone→serialize, so the lookup misses and it falls back to `'fixed'`.

See [ADR-0006](adr/0006-primitive-node-copy-paste-lifecycle.md) for proposed fixes and design tradeoffs.

## Code references

- `widget.serialize` checked: `src/lib/litegraph/src/LGraphNode.ts` serialize() and configure()
- `widget.options.serialize` checked: `src/utils/executionUtil.ts`
- `widget.options.serialize` set: `src/scripts/widgets.ts` addValueControlWidgets()
- `widget.serialize` set: `src/composables/node/useNodeImage.ts`, `src/extensions/core/previewAny.ts`, etc.
- Metadata types: `src/types/metadataTypes.ts`
- PrimitiveNode: `src/extensions/core/widgetInputs.ts`
- Positional widget-value restore: `src/stores/widgetValueStore.ts` `getPositionalRestoredWidgetValue()`
- Copy/paste serialization: `src/lib/litegraph/src/LGraphCanvas.ts` `_serializeItems()`
- Clone: `src/lib/litegraph/src/LGraphNode.ts` `clone()`
