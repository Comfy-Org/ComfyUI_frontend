# ADR-ECS-WIDGETS-0023: Widget Entities with a Legacy Layer

Date: 2026-08-26

## Status

Proposed

## Context

[ADR-ECS-0008](ECS-0008-entity-component-system.md) separates entity identity, plain
component data, and system behavior. Widgets only partly follow that model.
`WidgetId` and widget values are store-backed, but `BaseWidget` still combines
identity, mutable state, rendering, input handling, serialization hooks, and a
back-reference to its node.

Extensions also treat `node.widgets` as a public JavaScript API. They add object
literals and class instances, retain references to those objects, define
prototype methods and accessors, and mutate the array directly. For example,
`comfy_mtb` passes a `CurveWidget` instance with prototype methods for drawing,
pointer handling, and sizing to `addCustomWidget`.

The classic canvas can use these objects directly. A store-backed renderer
cannot see a widget until it has been registered with the stores. This can leave
the two renderers with different widget sets.

Converting every extension object to `BaseWidget` would close the registration
gap, but it would also change behavior visible to extensions. Replacing a
prototype can remove inherited methods, break retained-reference assumptions,
and fail for objects that cannot be modified. Widget registration therefore
needs a compatibility boundary that preserves foreign objects while making
their state available to core systems.

## Decision

Represent a widget as a `WidgetId` plus plain data held in dedicated stores.
Keep behavior supplied by extensions behind a compatibility adapter. Do not
replace the prototype of an extension object during registration.

### Identity and state

1. Stores, systems, renderers, serialization adapters, diagnostics, and tests
   identify widgets by `WidgetId`. JavaScript object identity and class
   membership do not define widget identity.
2. This ADR keeps the current derived `WidgetId` format,
   `graphId:nodeId:name`. Changing that format requires a separate decision that
   addresses persistence, lifecycle, collisions, and migration.
3. Authoritative widget state belongs in plain-data components keyed by
   `WidgetId`. Components have no methods, prototype requirements, or
   back-references to `LGraphNode`.
4. Core systems and renderers read those components. New core behavior must not
   require a `BaseWidget` subclass or an `instanceof` check.

### Extension behavior

An extension object may implement drawing, pointer handling, sizing, callbacks,
or accessors that are not represented in components. One compatibility adapter
registry maps each `WidgetId` to its original extension object and invokes the
supported hooks on that object.

The compatibility adapter must:

- keep extension objects out of serialized entity state;
- preserve the original object and its prototype;
- expose supported behavior to core code only through the adapter; and
- leave the legacy collection, component stores, indexes, and adapter registry
  unchanged if registration cannot complete.

`BaseWidget` remains part of the migration, but it is not the target entity
model or a new requirement for extensions.

### Compatibility contract

Until a capability is deprecated, supported legacy widgets must have the same
presence, order, value, visibility, and socket or control classification in the
legacy collection and store-backed queries. Retained extension references must
continue to reach supported state and behavior, including prototype methods and
accessors.

Before implementing the adapter, record which `node.widgets` mutations and
reflection operations the current API supports. Turn that inventory into a
compatibility matrix and tests. Do not use broad terms such as "array-like" as
a substitute for naming the supported operations.

Registration and removal must update the legacy collection, component stores,
indexes, and adapter registry as one operation. On failure, none of those views
may retain a partial registration or removal.

## Migration

1. Record the current API's supported operations and extension object shapes
   using ecosystem code search and extension fixtures.
2. Run those operations against the legacy collection, store-backed queries,
   and both renderers.
3. Add the adapter without replacing prototypes, then move core consumers from
   `BaseWidget` state to store components.
4. Remove a legacy path only after serialization, restore, subgraphs, both
   renderers, and extension fixtures produce equivalent results.
5. Deprecate extension behavior only after documenting its replacement and
   measuring remaining use over a stated observation window. Define the
   threshold and rollback condition in the deprecation proposal.

Removing the compatibility adapter requires a follow-up ADR or an amendment to
this one.

## Alternatives Considered

### Convert every widget to `BaseWidget`

This would simplify registration, but converting foreign objects can change
their prototypes, descriptors, identity, and behavior. It would also make the
class model permanent when ADR-ECS-0008 intends to separate state from behavior.

### Keep extension objects in stores

This would preserve their references, but mutable foreign objects would then
control serialization and reactivity. Core systems could not rely on plain,
deterministic component data.

### Clone or proxy extension objects

This would avoid prototype replacement but change object identity and some
reflection behavior. Existing extensions have not opted into that contract.

### Remove direct widget mutation now

This would avoid a compatibility adapter, but it would break existing
extensions before a replacement API and migration path exist.

### Mint a new widget identifier

A minted identifier could survive a definition rename, but it would reopen the
persistence and reattachment questions settled by ADR-ECS-0008. It is not required
to establish the behavior boundary.

## Consequences

If implemented, this decision will let both renderers use the same component
state without requiring extensions to inherit from `BaseWidget`. Foreign
objects will retain their existing identity and prototypes behind a defined
compatibility boundary.

The migration will temporarily require stores, a legacy collection, and an
adapter registry to remain synchronized. Some JavaScript mutations may not be
safe to support and will need explicit deprecation. Opaque extension behavior
will also limit serialization, collaboration, and worker isolation until
extensions move to declarative APIs.

The current `WidgetId` format still cannot distinguish duplicate names and does
not preserve state across definition renames. This ADR accepts those limits
from ADR-ECS-0008 rather than changing widget identity as part of the behavior
migration.

## Notes

This ADR narrows the widget portion of
[ADR-ECS-0008](ECS-0008-entity-component-system.md). It follows
[ADR-RENDERING-ATOMICITY-0020](RENDERING-ATOMICITY-0020-frame-atomic-rendering.md) by keeping compatibility work at
the registration boundary instead of adding it to renderer inner loops.

Bevy's [ECS callback example](https://bevy.org/examples/ecs-entity-component-system/callbacks/)
shows a related behavior boundary: a component holds a registered system ID,
and the ECS runs that system on demand.

---

## Amended (2026-10-26): a per-node widget form is emitted only where it can be _proven_

`widgets_values_form` is a per-node declaration of which widgets serialize and in what order
(`comfy-multi-player` schema amendment A24). A node carrying one is addressed through that form
and **consults no widget catalog on any leg**. That makes the error asymmetry total:

- A node with **no** form keeps today's catalog behaviour, which is imperfect but visible — a
  name that does not resolve is refused loudly.
- A node with a **wrong** form is authoritative. Values are misplaced silently and nothing
  downstream has anything left to disagree with.

So the rule is not "derive the order from `node.widgets`". It is:

> **Emit a form only where core can prove the final `widgets_values` is the array it itself
> produced from `node.widgets`. Where it cannot prove that, emit nothing.**

Deriving is a guess dressed as a declaration; proving is not. `proveWidgetForm`
(`src/lib/litegraph/src/widgets/widgetFormProof.ts`) is that predicate, and it returns an order
**only** alongside `provable: true` — never a partial order beside a refusal.

### Why deriving does not work, measured

The obvious implementation — derive after `runExtensionSerializeHook`, since that hook sees the
final values — is wrong for two independent reasons.

**`LGraphNode.serialize` is not the last writer.** `SubgraphNode.serializeFromStoreState` calls
`super.serializeFromStoreState(state)` — hook included — and _then_ replaces `widgets_values`
from `this.inputs` filtered to those carrying a `widgetId`, or deletes it. That is a different
collection from `node.widgets` (promoted widgets are linked inputs, per
[ADR-SUBGRAPH-PROMOTION-0009](SUBGRAPH-PROMOTION-0009-represent-promoted-widgets-as-linked-inputs.md)),
so a form written at the end of the base method is already stale when the subclass returns. The
proof catches this on **array identity**, deliberately not deep equality: a rebuilt
equal-looking array came from a source core cannot see, and a coincidental match is not evidence.

**`node.widgets` is a public JavaScript API that extensions mutate**, as the ADR body above
already describes. Shipping packs splice it, truncate it (`this.widgets.length = n`), reorder
it, and replace it wholesale during `onNodeCreated`; `this.serialize_widgets = false` appears in
the low hundreds of repositories. None of that is a defect to fix — it is the contract this ADR
documents — so the form has to tolerate it rather than assume it away.

### The flag trap, which is the most likely way to get this wrong

Three predicates look interchangeable and are deliberately different:

| predicate                            | effect on `widgets_values`                    |
| ------------------------------------ | --------------------------------------------- |
| `widget.serialize === false`         | **excluded** — the only one that governs it   |
| `widget.options.serialize === false` | **not excluded**; affects the API prompt only |
| either false                         | neither; governs promotion and preview        |

`addWidget` does not hoist the options-bag flag onto the widget, so a widget flagged only there
**does occupy a positional slot.** That is why every `KSampler` serializes 7 values
(`control_after_generate`) and every `LoadImage` serializes 2 (its upload button). A form built from `options.serialize` is one slot
short on both.

`LGraphNode.widgetFormProof.test.ts` pins the _rule_ against the real serializer: the flag cases
build an `LGraphNode` in a graph, add widgets through `addWidget`, and read `node.serialize()`, so
the assertion is on production's own `widgets_values` rather than on a filter the test duplicates.
Measured there: `addWidget('combo', …, { serialize: false, values: [...] })` leaves
`widget.serialize` `undefined` with `widget.options.serialize === false`, and the widget still
occupies a slot. It lives beside `LGraphNode` rather than in `widgets/` because importing
`LGraphNode` is what the `node-widgets` → `litegraph-api` boundary below forbids;
`widgetFormProof.test.ts` keeps the pure-predicate cases and stays inside that boundary.

It does **not** instantiate a real `KSampler` or `LoadImage`, so the 7 and the 2 above remain
measurements of production code rather than assertions this file makes. Pinning them against the
real widget lists needs the extension constructors and so lives in the stacked test PR; until
that lands, treat those two numbers as evidence for the rule rather than as regression cover for
it.

### Refusals, each a measured shape

`class_may_rewrite_payload` · `replayed_serialization` · `widgets_not_serialized` ·
`values_missing` · `values_replaced` · `values_not_positional` · `length_mismatch` ·
`duplicate_widget_name` · `unnameable_widget`

Four are worth calling out. **`replayed_serialization`** covers an unregistered node type, whose
payload is replayed verbatim and never reaches the hook, and whose widgets are _synthesised from
the stored values_ with names `UNKNOWN`, `UNKNOWN_1`, … A form there would be syntactically
valid, authoritative, and meaningless, so it is refused before any other check can accept it.
**`duplicate_widget_name`** covers two serializing widgets sharing a name: the named projection
collapses them via `defineProperty`, and the document rejects the second address outright, so
listing both would promise an address that does not resolve. Measured in the corpus: `RecordAudio`
stores 2 values under 1 name and `LoadAudio` 3 under 2.

**`values_missing`** and **`values_replaced`** are deliberately distinct, because they send a
reader to different problems. `values_missing` is an absent `widgets_values` — the
`delete serialized.widgets_values` branch a `SubgraphNode` takes when every promoted store value
is `undefined`. `values_replaced` is an array core did not produce, which is the shape a pack's
own `serialize` override leaves behind. `values_not_positional` is reserved for an
object-shaped payload: the VHS family's `onSerialize` writes a dict keyed by every widget name,
including widgets flagged `serialize === false`, so its keys and any derived order disagree.
`widgets_not_serialized` covers `this.serialize_widgets = false`, which rgthree's group muters,
was-node-suite's fast groups and Crystools' debugger all set.

### What the proof does not guarantee

Array identity proves the payload is still core's own array. It does not prove the array's
_contents_ were untouched: a serialize hook can reorder `node.widgets`, or mutate the produced
array in place, while preserving both identity and length. `proveWidgetForm` would then report
`provable: true` with an order that does not match the values.

That is a known limit, not an oversight, and it is why nothing calls this predicate yet. A
producer must close it first — by snapshotting the pre-hook order, or by validating contents
rather than identity — and that belongs in the change that adds the producer, where the pre-hook
state is in scope.

### The call site is part of the rule, not an implementation detail

The first version of this amendment said the form is emitted "after the extension serialize hook"
and left it there. That is wrong, and driving the predicate through the real serialize path proved
it: at the end of `LGraphNode.serializeFromStoreState` a `SubgraphNode`'s `widgets_values` is
**still core's own array** — the subclass replaces it only after `super` returns. So the identity
check, which exists precisely to catch that subclass, passed. The proof **accepted**, returning an
order of two names for a payload that ended up holding one value.

An acceptance is the one outcome this design cannot tolerate, so the fix is not a better call site —
it is to stop trusting the caller to know it stands at the last writer. `coreIsLastWriter` is a
**required** option with no default:

```ts
coreIsLastWriter: node.serializeFromStoreState ===
  LGraphNode.prototype.serializeFromStoreState &&
  node.serialize === LGraphNode.prototype.serialize
```

Required rather than derived for two reasons. `tsc` then refuses any new call site until the
question has been answered, so the assumption cannot creep back in silently. And the comparison
needs both the instance and the base prototype in scope, which is true at the call site and not
inside the widgets layer — deriving it here would mean importing `LGraphNode` across the
`node-widgets` → `graph-model` boundary that this repo's own architecture gate enforces.

It is checked **before** every other refusal, because a payload that is not final makes the rest
moot: reporting `duplicate_widget_name` on a payload about to be replaced sends a reader to the
wrong problem. The refusal is `class_may_rewrite_payload`, and it covers packs that override
`serialize` exactly as it covers `SubgraphNode`.

Passing a hardcoded `true` to silence the type error reintroduces the defect. That is worth saying
out loud, because it is the cheapest wrong fix available.

### Scope

This amendment adds the predicate and a diagnostic (`needsFormButHasNone`, which identifies
object-shaped values with no form — the population a form would rescue and that nothing can
currently count). **Nothing emits a form through `proveWidgetForm` yet.** The producer is
deliberately a later change, so the predicate can be landed, measured against the custom-node
ecosystem, and trusted first.

That is narrower than "no form is emitted anywhere", and the difference matters to whoever wires
this up. The Agent wire already declares forms on its own `add_node` path:
`docOpMinter.wireNodeSnapshot` attaches `widgets_values_form` from
`provenWidgetValuesForm` (`src/workbench/extensions/agent/crdt/widgetValuesForm.ts`, per
[ADR-WIDGET-SERIALIZATION-0047](WIDGET-SERIALIZATION-0047-agent-wire-widget-form-is-proven-not-derived.md)).
That producer reads the post-hook payload and reaches the same conclusion by a different route;
reconciling the two, so core serialization and the Agent wire share one predicate, is the
follow-up this amendment makes possible rather than something it does.
