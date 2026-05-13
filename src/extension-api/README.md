# Extension API — Public Source of Truth

> **Status**: Implemented (Phase A). Runtime backed by stub ECS components;
> full ECS integration lands with #11939.

This folder is the single source of truth for the public ComfyUI extension
API. Every file here is part of the published `@comfyorg/extension-api`
npm package. Do not re-export from `/src` — this barrel is the **published
package entry point**, which is the explicit exception to the project's
"no barrel files in /src" rule (root AGENTS.md rule #19).

## File structure

```
extension-api/
├── index.ts          ← barrel — package entry point
├── node.ts           ← NodeHandle interface + node event payload types
├── widget.ts         ← WidgetHandle interface + widget event payload types
├── types.ts          ← ExtensionOptions, NodeExtensionOptions, WidgetExtensionOptions
├── events.ts         ← Handler<E>, AsyncHandler<E>, Unsubscribe
├── lifecycle.ts      ← onNodeMounted, onNodeRemoved hooks + rationale docs
├── shell.ts          ← SidebarTabExtension, BottomPanelExtension, CommandManager, etc.
├── identifiers.ts    ← NodeLocatorId, NodeExecutionId + parsers/type guards
└── README.md         ← this file
```

## What about v1?

v1 (`ComfyExtension` interface in `../types/comfy.ts`, `app.registerExtension(...)`
runtime entry point in `../scripts/app.ts`) **stays in its current locations**.
Custom extensions in the wild consume the runtime entry point, not the type
file — moving the type file would churn ~30 internal imports for zero runtime
benefit. The v1↔v2 distinction is at the entry point, not the folder.

## Authoring rules

1. **Hand-authored**, not generated. This is a public API; we own the shape.
2. **No `any`, no `as any`, no `@ts-expect-error`.** If you need an escape
   hatch, the type is wrong.
3. Every public type has a TSDoc block with at minimum:
   - 1-line summary
   - `@stability` tag (`stable` | `experimental` | `deprecated`)
   - `@example` block (where applicable)
4. Naming follows conventions:
   - Read-only invariants (set at construction): `readonly` property
   - Read-only state (changes over time): method (`getValue()`)
   - Mutating actions: method (`setValue(v)`)
   - Boolean predicates: method (`isHidden()`)
5. Events: typed payloads, no `Function`, split-channel events
   (`valueChange` / `optionChange` / `propertyChange`).
6. No internal types (`World`, `Component<T>`, branded `EntityId` internals)
   leak through this barrel.

## Key design decisions

| ADR                                                                           | Decision                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- |
| [ADR-0008](../../docs/adr/0008-entity-component-system.md)                    | Entity Component System architecture                      |
| [ADR-0010](../../docs/adr/0010-deprecate-node-level-serialization-control.md) | Deprecate `node.on('beforeSerialize')` — use widget-level |
| [ADR-0011](../../docs/adr/0011-immutability-via-fresh-copies.md)              | Return fresh copies from collection methods               |
| [ADR-0012](../../docs/adr/0012-pure-function-loader-pattern.md)               | Pure function registration + loader activation            |

## Related research

- [Identity encapsulation](../../docs/research/identity-encapsulation.md) — when extensions need raw entity IDs
- [Coordinate systems](../../docs/research/coordinate-systems.md) — canvas vs screen coordinates
- [Widget state categories](../../docs/research/widget-state-categories.md) — value/properties/options/DOM
- [Serialization context](../../docs/research/serialization-context.md) — workflow/prompt/clone/subgraph-promote
