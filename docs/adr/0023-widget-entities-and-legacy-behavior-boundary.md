# 23. Widget Entities and Legacy Behavior Boundary

Date: 2026-08-26

## Status

Proposed

## Context

[ADR 0008](0008-entity-component-system.md) separates entity identity, plain
component data, and system behavior. Widgets only partially follow that model.
`WidgetId` and widget value state are store-backed, while `BaseWidget` and its
subclasses still combine identity, mutable data, rendering behavior, input
handling, serialization hooks, and a back-reference to their node.

The extension ecosystem also treats `node.widgets` as a public JavaScript
boundary. Extensions add object literals and foreign class instances, retain
references to them, define getters and setters, place methods on their
prototypes, and mutate the array through `push`, `splice`, index assignment, or
whole-array replacement. The classic canvas can execute these objects directly.
Store-backed renderers cannot see a widget until its state crosses the store
registration boundary.

That mismatch produced a split source of truth: a legacy widget could remain in
`node.widgets` and render on the classic canvas while being absent from the
store-driven renderer. Converting every object to a framework class repairs
registration, but changing a foreign object's prototype can remove inherited
behavior, change reflection and serialization, fail on non-extensible or proxy
objects, and violate identity assumptions held by extension code.

Reactive frameworks expose the same trade-off explicitly. Vue warns that raw
and proxied versions of one object have different identity and provides
`markRaw` for third-party class instances. Pinia recommends that boundary for
external classes. MobX distinguishes cloning/proxying from in-place
instrumentation and does not automatically convert class instances. Immer
requires classes to opt in and preserves their prototypes. These precedents do
not define ComfyUI's compatibility contract, but they show that foreign object
behavior requires an explicit boundary rather than implicit coercion.

## Decision

Model a widget as stable `WidgetId` identity plus plain store-owned components.
Treat extension-supplied behavior as an opaque compatibility adapter, not as
widget entity state and not as a prototype to replace.

### Identity and component authority

1. `WidgetId` is the authoritative identity used by stores, systems, renderers,
   serialization adapters, diagnostics, and tests. JavaScript object identity
   and class membership are not widget identity.
2. This ADR retains ADR 0008's current derived `WidgetId`
   (`graphId:nodeId:name`). It does not introduce a minted identifier. A future
   identity proposal must satisfy ADR 0008's persistence, lifecycle, collision,
   and migration evidence gates before superseding that choice.
3. Authoritative widget state is split into plain-data components keyed by
   `WidgetId`. Components contain no methods, prototype requirements, or
   back-references to `LGraphNode`. At minimum, stores must make value, type,
   order, visibility, configuration, and node ownership explicit where those
   concerns are authoritative.
4. Systems and renderers query components. New core behavior must not depend on
   a `BaseWidget` subclass, `instanceof`, or prototype methods.

### Foreign behavior adapter

An extension object may provide behavior that cannot yet be represented as
plain components, including custom drawing, pointer handling, sizing, callbacks,
and accessors. The compatibility layer may associate that object with a
`WidgetId` as an opaque behavior adapter.

- The adapter is not serialized as entity state and is not copied into
  components.
- Core code invokes supported behavior through an explicit adapter interface or
  compatibility system.
- Registration must not replace the foreign object's prototype.
- Registration should retain the original object reference when the legacy
  contract requires it. If that is impossible, the operation must fail or fall
  back atomically; partial descriptor or prototype transplantation is not an
  accepted state.
- New extension APIs should register declarative components and named behavior
  capabilities rather than expose new mutable framework instances.

`BaseWidget` remains a migration implementation detail while core widget
behavior is extracted. It is not the target entity model and must not become a
new extension requirement.

### Legacy compatibility invariants

Until a capability is explicitly deprecated, the compatibility boundary must
preserve these observable behaviors for supported legacy widgets:

1. Widgets added through `addCustomWidget` and supported `node.widgets` array
   mutations become addressable by `WidgetId` and visible to both renderers.
2. Widget order, presence, value, visibility, and socket/control classification
   agree between the legacy collection view and store-native queries.
3. Retained extension references continue to reach the registered widget's
   supported state and behavior.
4. Foreign prototype methods and accessors are not discarded merely because an
   object does not extend `BaseWidget`.
5. Registration and removal are atomic across the collection view, component
   stores, indexes, and behavior-adapter registry.
6. Duplicate structural identity, widget-definition rename, graph attachment,
   graph detachment, serialization, restore, and teardown have deterministic
   outcomes and diagnostics.

Support for a particular array or reflection operation must be named and tested;
the phrase "array-like" is not a compatibility specification. The initial
inventory must evaluate `push`, `unshift`, `splice`, index assignment, deletion,
length truncation, reorder, spread replacement, and whole-array assignment.

### Migration and evidence gates

Migration proceeds in stages:

1. **Inventory and characterize.** Record current behavior with ecosystem code
   search, representative custom-node fixtures, and telemetry that does not
   collect workflow contents. Classify plain object, foreign class, proxy, and
   framework-owned widget usage separately.
2. **Establish parity tests.** Run the same widget operation histories against a
   simple ordered-`WidgetId` model, store-native queries, classic rendering, and
   the store-backed renderer. Add adversarial fixtures for frozen, sealed,
   non-extensible, null-prototype, accessor-heavy, symbol-bearing, cyclic,
   cross-realm, and hostile or revoked proxy objects.
3. **Introduce the adapter boundary.** Associate legacy behavior with
   `WidgetId` without prototype replacement. Keep the old public collection
   view synchronized at the boundary while core consumers move to components.
4. **Extract framework behavior.** Move first-party widget behavior from class
   methods into systems or named capabilities. Do not remove a legacy path until
   store-native renderers, serialization, restore, subgraphs, and extension
   fixtures have semantic parity.
5. **Deprecate with evidence.** Deprecation requires a documented replacement,
   migration guidance, at least one release of diagnostics, representative
   ecosystem validation, and evidence that remaining use is below an agreed
   threshold. A deprecation proposal must name the telemetry denominator,
   observation window, and rollback condition.
6. **Remove deliberately.** Removal requires an accepted follow-up ADR or an
   amendment to this ADR, release notes, and a compatibility-matrix update.
   Absence from internal code search alone is not removal evidence.

Each stage has a rollback boundary. A renderer or store migration that violates
an invariant returns to the preceding adapter path; it must not repair parity by
silently rewriting extension objects.

## Alternatives Considered

- **Convert every widget to `BaseWidget` best-effort.** This centralizes
  registration quickly, but prototype replacement and descriptor
  transplantation alter foreign objects and preserve class dependence that ADR
  0008 intends to remove.
- **Keep `BaseWidget` as the permanent entity model.** This preserves current
  implementation familiarity but continues to mix identity, state, behavior,
  and ownership, and makes non-class extension objects second-class.
- **Use extension objects themselves as store entities.** This preserves
  references but gives mutable foreign objects authority over data lifecycle,
  serialization, and reactivity, preventing deterministic systems and clear
  teardown.
- **Clone or proxy all extension objects.** This avoids prototype mutation but
  changes identity, equality, `WeakMap`, `indexOf`, accessor, and exotic-object
  behavior unless the extension opts into that contract.
- **Remove legacy widget mutation immediately.** This yields the cleanest target
  but breaks a mature ecosystem before a supported replacement and usage
  evidence exist.
- **Mint a new widget identifier.** This can decouple identity from name, but it
  reopens ADR 0008's rejected persistence and reattachment problem and is not
  needed to establish the behavior boundary.

## Consequences

### Positive

- Widget identity and authoritative state no longer depend on JavaScript class
  identity or prototype mutation.
- Classic and store-backed renderers can consume one component model while
  legacy behavior remains available through a bounded adapter.
- Foreign extension objects keep their prototypes, methods, accessors, and
  retained-reference semantics within the documented compatibility surface.
- Plain components support deterministic tests, diagnostics, serialization,
  renderer snapshots, and the longer-term command/system direction of ADRs
  0003 and 0008.
- Explicit evidence gates make ecosystem deprecation reviewable and reversible.

### Negative

- During migration, components, a legacy collection view, and a behavior
  adapter coexist and require transactional registration and teardown.
- Not every arbitrary JavaScript mutation can be observed safely. The supported
  surface must be inventoried, tested, and narrowed deliberately.
- Opaque behavior remains an escape hatch that limits serialization,
  collaboration, and worker isolation until extensions adopt declarative APIs.
- Stable `WidgetId` does not by itself solve definition renames or duplicate
  names; ADR 0008's structural-key collision rules still apply.
- Ecosystem fixtures, telemetry, differential tests, and staged deprecation add
  release and maintenance cost.

## Notes

This ADR narrows the widget portion of [ADR 0008](0008-entity-component-system.md)
and follows [ADR 0020](0020-bound-renderer-reactivity.md) by keeping
compatibility work at explicit boundaries rather than in renderer inner loops.

Primary design references:

- [Vue: Reactivity API — Advanced](https://vuejs.org/api/reactivity-advanced.html)
- [Pinia: Plugins — Adding new external properties](https://pinia.vuejs.org/core-concepts/plugins.html#adding-new-external-properties)
- [MobX: Creating observable state](https://mobx.js.org/observable-state.html)
- [Immer: Classes](https://immerjs.github.io/immer/complex-objects/)
- [Redux Toolkit: `createEntityAdapter`](https://redux-toolkit.js.org/api/createEntityAdapter)
- [VS Code: Extension API guidelines](https://github.com/microsoft/vscode/wiki/Extension-API-guidelines)
- [fast-check: Model-based testing](https://fast-check.dev/docs/advanced/model-based-testing/)
