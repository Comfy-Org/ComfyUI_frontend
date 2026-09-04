# 28. Separate Widget Semantic Type from Renderer Key

Date: 2026-08-24

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

[ADR 0008](0008-entity-component-system.md) defines
`WidgetId = graphId:nodeId:name` as the single canonical widget identity and
makes dedicated stores authoritative for widget data. A widget's `type`
instead describes aspects of its semantic and presentation contracts.
The extension API predates that model: `IBaseWidget.type` is a public writable
property, and custom nodes change it after registration to select a different
renderer or interaction model.

Those contracts conflict. Semantic classification should be stable after
registration so validation, connection compatibility, reconstruction, and
systems can rely on it. Renderer selection is presentation state and may
legitimately change during a widget's lifetime. Using one string for both
creates two failure modes:

- Treating `type` as immutable breaks extensions that use post-registration
  assignment as a presentation switch.
- Treating the live widget object as authoritative allows it to drift from the
  widget store. Store-driven Vue consumers can then select a different component
  from legacy consumers of the live object.

The node definition schema already draws this distinction and the frontend
discards it. `InputSpec.type` carries the data contract (`INT`, `MODEL`,
`COMBO`) and `InputSpec.widgetType` carries an optional presentation override.
`addInputWidget` in `src/services/litegraphService.ts` collapses them with
`widgetInputSpec.type = inputSpec.widgetType` before the widget is constructed,
so the semantic contract is overwritten by a presentation choice at
registration time. Restoring the distinction is the substance of this ADR, not
a new concept introduced by it.

PR [#15766](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15766) is a
compatibility repair: after registration, legacy `widget.type = value` writes
through to the widget state used by Vue component dispatch. It removes the
immediate split-brain behavior, but retaining one mutable field for semantic
classification and presentation dispatch is not the desired long-term API.

The migration also has to account for widgets that exist only as projections,
including promoted subgraph widgets, and for extensions compiled against the
current `IBaseWidget` interface. A consumer-only fallback to
`liveWidget.type ?? widgetState.type` cannot cover projections with no live
widget and is not reliably reactive when an extension assigns a plain object
property.

## Decision

Separate semantic widget classification from presentation dispatch, and name
each field for the contract it owns rather than for its position relative to
the legacy name.

### Field names

`semanticType` and `rendererKey` replace the working names `kind` and
`presentationType`. Two considerations fixed this choice:

- `kind` alongside a deprecated `type` reads as a distinction without a stated
  difference, and `kind` is easy to mistake for identity, which
  [ADR 0008](0008-entity-component-system.md) already assigns to `WidgetId`.
- `presentationType` promises visibility and interaction model in addition to
  renderer selection. The field only selects a component, so its name says so.

### Fields and their contracts

1. Add an immutable `semanticType` to widget state. `semanticType` defines the
   widget's value, validation, connection compatibility, and reconstruction
   contract. It is fixed when the widget is registered and no public API
   mutates it afterwards.
2. Add a store-backed `rendererKey`. It selects the Vue component or canvas
   widget class used to draw the widget, and nothing else. It may change
   through a validated widget store action and, once widget commands are
   available, through the corresponding serializable command.
3. `rendererKey` does not carry visibility or interaction model. Visibility is
   separate store-backed widget state, not a renderer identifier; the legacy
   `type = 'hidden'` assignment is a presentation hack that migrates to that
   state rather than to `rendererKey`. Interaction model follows from the
   selected component and is not independently addressable.

### Sources at registration

4. `semanticType` derives from the node definition, not from the live widget
   object: it is `InputSpec.type` for schema-declared inputs, and the declared
   semantic type of the registration call for widgets added programmatically.
   `rendererKey` is seeded from `InputSpec.widgetType` when present and
   otherwise from `semanticType`. `addInputWidget` stops overwriting
   `widgetInputSpec.type` with `inputSpec.widgetType`.
5. Legacy `type` assignment before registration is presentation-only: it seeds
   `rendererKey` and never `semanticType`. An extension that needs a widget
   whose semantic contract differs from its node-definition input declares it
   through the explicit registration API; there is no path by which assigning
   `type` sets a semantic contract. This is a deliberate behavior change from
   the current code, where a pre-registration `type = 'hidden'` write would
   otherwise become the widget's permanent semantic classification.

### Consumers

6. Value coercion, validation, connection compatibility, type narrowing, and
   reconstruction read `semanticType`. Renderer lookup reads `rendererKey`.
   Store-driven consumers do not fall back to the live widget object. Live
   widgets and promoted-widget adapters project the same authoritative store
   state.

### Compatibility boundary

7. Keep `IBaseWidget.type` as a deprecated compatibility property during the
   extension migration. After registration, reads project `rendererKey` and
   writes update `rendererKey`; writes never mutate `semanticType`.
8. Staged compatibility requires a registered widget: a `BaseWidget` subclass,
   a `LegacyWidget` wrapper, or the compatibility adapter defined by
   [ADR 0023](0023-widget-entities-and-legacy-behavior-boundary.md). A plain
   object with an unrecognized `type` is left unwrapped by
   `toConcreteWidget(widget, node, false)` and is not node-bindable, so it has
   no store entry; its `type` writes cannot reach `rendererKey` and cannot
   drive store-backed consumers. Those widgets are outside the compatibility
   promise of this ADR, and closing that gap is ADR 0023's adapter registry,
   not a fallback path added here.
9. Emit a development-mode deprecation warning for post-registration `type`
   assignment, with migration guidance to the explicit presentation API.

### Persistence

10. Presentation state is ephemeral by default. `rendererKey` is not
    serialized unless the widget's semantic contract declares it durable
    workflow state, and a widget declares that once at registration rather
    than per assignment. Legacy `type` writes therefore never make a
    presentation change persistent; an extension that needs a durable renderer
    change opts in through the semantic contract.
11. `semanticType` is serialized wherever semantic reconstruction requires it.

### Removal

12. The compatibility promise covers both runtime behavior and TypeScript
    source compatibility. `IBaseWidget.type` is the generic literal
    discriminant `TType extends string` that every widget interface and
    `WidgetTypeMap` entry narrows on, so removing or renaming it is a source
    break for extensions compiled against the published types, not only a
    runtime break.
13. Writable `type` may be removed no earlier than two consecutive stable
    frontend releases after the release that ships the deprecation warning.
    The removal PR must report: zero writable `type` uses in built-in widgets
    and core code; zero writable uses across the custom-node corpus executed by
    the `ecosystem-matrix` CI job; and deprecation-warning telemetry from the
    supported release channels. The two-release window and that corpus are the
    default; widening either is a decision for the widget architecture owner
    recorded on the removal PR.

Alternatives considered:

- **Make `type` immutable immediately.** Rejected because post-registration
  assignment is an existing extension behavior with no supported replacement.
- **Keep `type` as the permanently mutable canonical field.** Rejected because
  identity and presentation retain incompatible lifecycle and persistence rules.
- **Make each Vue consumer prefer the live widget's `type`.** Rejected because it
  creates two authorities, misses store-only projections, depends on every future
  consumer applying the same fallback, and does not make plain-property writes
  reactive by itself.
- **Rename `type` to `semanticType` without adding presentation state.**
  Rejected because it removes the mechanism custom nodes currently use to change
  renderer behavior.
- **Seed `semanticType` from the pre-registration `type` value.** Rejected
  because an extension that assigns a presentation value such as `hidden`
  before registration would fix it as the semantic contract, which defeats the
  separation this ADR exists to create.
- **Store a renderer component directly on the widget.** Rejected because
  components are not serializable domain state and would couple widget entities to
  the Vue renderer.

## Consequences

### Positive

- Widget semantic classification becomes stable and suitable for validation,
  connection compatibility, reconstruction, and deterministic commands.
- Dynamic renderer changes remain supported without mutating that semantic
  classification.
- Vue, legacy adapters, and promoted widgets observe one authoritative reactive
  value instead of applying consumer-specific fallback rules.
- The node definition's existing `type` and `widgetType` distinction survives
  registration instead of being collapsed into one string.
- The deprecated property provides a staged migration path for custom nodes rather
  than an ecosystem-wide breaking change.
- Persistence is decided by one default rather than inherited from the ambiguous
  behavior of the overloaded `type` property.

### Negative

- Widget state and APIs gain two related fields, and callers must choose the right
  one.
- During migration, `type` and `rendererKey` are aliases, which adds temporary
  compatibility machinery and documentation burden.
- Extensions that relied on a pre-registration `type` assignment to change
  semantic behavior lose that path and must use the explicit registration API.
- Extensions that supply unregistered plain-object widgets gain nothing from
  this ADR until ADR 0023's adapter registry lands.
- Existing widget subclasses and custom nodes require migration, telemetry or
  ecosystem testing, and a deprecation window before the legacy setter can be
  removed.
- Widgets that need a durable renderer change must declare it at registration
  instead of relying on assignment, which is stricter than current behavior.
- Widget mutation commands are not yet complete, so the first implementation will
  use a validated store action before it can satisfy the full command architecture.

## Notes

- [ADR 0008](0008-entity-component-system.md) defines widget identity and the
  dedicated-store authority this proposal refines.
- [ADR 0023](0023-widget-entities-and-legacy-behavior-boundary.md) defines the
  compatibility boundary for extension-supplied widget objects that this ADR
  depends on for unregistered plain objects.
- [ADR 0003](0003-crdt-based-layout-system.md) defines the longer-term command
  properties required for durable graph-domain mutations.
- The compatibility repair in PR #15766 should not be interpreted as making one
  mutable field for semantic classification and presentation permanent.
