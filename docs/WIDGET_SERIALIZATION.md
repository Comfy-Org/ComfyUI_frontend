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
- `LGraphNode.serialize()` checks `widget.serialize === false` (line 967). It does **not** check `widget.options.serialize`. A widget with `options.serialize = false` is still included in `widgets_values`.
- `LGraphNode.serialize()` only writes `widgets_values` if `this.widgets` is truthy. Nodes that create widgets dynamically (like `PrimitiveNode`) will have no `widgets_values` in serialized output if serialized before widget creation — even if `this.widgets_values` exists on the instance from a prior `configure()` call.
- `widget.options.serialize` is typed as `IWidgetOptions.serialize` — both properties share the name `serialize` but live at different levels of the widget object.

## Code references

- `widget.serialize` checked: `src/lib/litegraph/src/LGraphNode.ts` serialize() and configure()
- `widget.options.serialize` checked: `src/utils/executionUtil.ts`
- `widget.options.serialize` set: `src/scripts/widgets.ts` addValueControlWidgets()
- `widget.serialize` set: `src/composables/node/useNodeImage.ts`, `src/extensions/core/previewAny.ts`, etc.
- Metadata types: `src/types/metadataTypes.ts`
