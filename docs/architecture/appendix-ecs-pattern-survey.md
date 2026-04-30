# Appendix: ECS Pattern Survey

_A survey of mainstream Entity Component System libraries — bitECS, miniplex,
koota, ECSY, and Bevy — captured during the world-consolidation analysis that
shipped slice 1 of [ADR 0008](../adr/0008-entity-component-system.md). This
appendix records which structural patterns our `src/world/` substrate adopts,
which it deliberately departs from, and where the trade-offs are load-bearing
rather than incidental._

The in-code anchors for the load-bearing constraints discussed below are the
doc-comments in [src/world/world.ts](../../src/world/world.ts) (storage
strategy) and [src/world/entityIds.ts](../../src/world/entityIds.ts) (identity
contract) — see §3 below.

---

## 1. Survey Comparison

Five libraries were sampled for structural patterns: where component
definitions live relative to the substrate, how components are declared,
how entities are identified, and roughly how large the substrate's public
surface is. Sources: the linked READMEs and docs.

| Library                                           | Component placement                  | Component definition style    | Entity ID type       |  Approx. # core exports |
| ------------------------------------------------- | ------------------------------------ | ----------------------------- | -------------------- | ----------------------: |
| [bitECS](https://github.com/NateTheGreatt/bitECS) | Outside the substrate; user's choice | plain arrays / objects        | `number` (unbranded) |                     ~12 |
| [miniplex](https://github.com/hmans/miniplex)     | Colocated with the `Entity` type     | properties on a TS type       | plain object ref     |                      ~5 |
| [koota](https://github.com/pmndrs/koota)          | Colocated with the consumer          | `trait({...})` factory        | numeric `.id()`      | ~15 (core) + ~8 (react) |
| [ECSY](https://github.com/ecsyjs/ecsy)            | User's choice                        | `class extends Component`     | `Entity` object      |                     ~10 |
| [Bevy](https://bevyengine.org/) (Rust, for shape) | Plugin-owned (industry std)          | `#[derive(Component)] struct` | `Entity(u64)`        |                     n/a |

Two structural patterns are unanimous across the surveyed libraries:

1. **Component definitions live with the code that owns the data**, not
   inside the substrate package. Whether by explicit recommendation
   (Bevy plugins, koota's colocation guidance) or by default (bitECS,
   miniplex), no surveyed substrate ships pre-defined component types.
2. **Substrate surface area is small** — bitECS at ~12 exports, koota at
   ~15, miniplex at ~5. ECSY is the outlier with a wider class hierarchy.

Our slice-1 end state — five source files under
[src/world/](../../src/world/), ~14 exported names total — sits squarely in
this band.

---

## 2. Patterns We Adopt

### 2.1 Substrate is deep; components live in domain code

The mainstream convention is that the ECS substrate exposes only the
machinery — entities, component keys, a World — and component definitions
live next to the system, store, or feature module that owns the data.
This is the Bevy / miniplex / koota convention by design and the bitECS /
ECSY convention by default.

Our substrate follows the same shape: `src/world/` contains entity-ID
brands, the `ComponentKey` definition primitive, and the `World`
interface, but no domain-specific component types. Slice 1 places
`WidgetValueComponent` and `WidgetContainerComponent` in
[src/stores/widgetComponents.ts](../../src/stores/widgetComponents.ts),
next to [widgetValueStore.ts](../../src/stores/widgetValueStore.ts) — the
module that already owns widget value state.

This keeps the substrate / domain seam crisp: the World knows how to store
and look up arbitrary components keyed by entity ID; the domain layer
knows what a "widget value" is. It also aligns with the AGENTS.md DDD
guidance to group code by bounded context. Future components follow the
same rule — `PositionComponent`, when it lands, will live with the layout
domain rather than inside the substrate.

### 2.2 Small public API

The substrate exports ~14 names — comparable to bitECS (~12) and koota
(~15), much smaller than ECSY's class hierarchy. This is a deliberate
target: every exported name is a contract a contributor must understand
before extending the World, and every export is a potential migration
cost when the substrate evolves.

The `Brand` / `EntityId` / `ComponentKey` / `World` / `worldInstance`
split keeps each module single-purpose. `Brand<T,Tag>` is 5
LOC and shared across all branded ID kinds. `ComponentKey<TData,TEntity>`
carries a two-parameter phantom that enables cross-kind compile-time
checking. `asGraphId` is a single named boundary cast. The two explicit
factories `nodeEntityId` / `widgetEntityId` are kept rather than collapsed
into a parameterized helper because slice 2/3/4 will add factories with
different parameter tuples (`rerouteEntityId`, `linkEntityId`,
`slotEntityId`); the explicit-factory pattern scales linearly with new
entity kinds without growing the helper's signature.

### 2.3 Reactive bridging via existing storage proxy

bitECS, koota, and miniplex bolt on a separate `onChange` event bus when
a consumer wants reactive notifications. koota's React layer
(`useTrait(entity, ComponentKey)`) is the closest analog to what
`useUpstreamValue` and future composables want.

Because our World stores values inside Vue's `reactive(Map<EntityId, ...>)`,
a plain `computed(() => world.getComponent(id, key))` already provides
fine-grained per-`(entity, component)` tracking — no separate event bus
is needed. **This is a real Vue-specific advantage.** The Vue tracker and
the ECS storage are the same mechanism, so reactivity falls out of the
storage choice rather than being layered on top.

### 2.4 Brand-typed entity IDs

No surveyed TypeScript ECS uses branded IDs. bitECS uses unbranded
`number`, miniplex uses plain object references, koota uses a numeric
`.id()`. Our `Brand<T, Tag>` over each entity kind enables the
type-level cross-kind isolation assertion in
[world.test.ts](../../src/world/world.test.ts) and documents slice-2/3/4
entity kinds at compile time.

This is a deliberate departure rather than an accident. It earns its keep
once `Position` lands on `NodeEntityId | RerouteEntityId` (slice 2) and
`Connectivity` lands on `SlotEntityId` (slice 4); without brands, those
component-key declarations would accept any numeric ID and silently allow
cross-kind misuse.

---

## 3. Patterns We Explicitly Do NOT Adopt

Each of the following is a real industry idiom we considered and rejected
on load-bearing grounds. None of these are pure performance trade-offs.

### 3.1 Replace-on-write usage idioms

koota's `entity.set(Position, {...})` and miniplex's `world.add(entity)`
**replace** component values with new objects on each write. Adopting
either would break
[BaseWidget.\_state](../../src/lib/litegraph/src/widgets/BaseWidget.ts)
shared reactive identity — the contract that lets DOM widget overrides,
`useProcessedWidgets` memoization, and the 40+ extension ecosystem all
read the same proxy. Our `setComponent(id, key, ref)` stores by reference
and the inner `reactive(Map)` keeps a stable cached proxy per
entity-component pair: every `getComponent` returns the same proxy,
regardless of how many writes intervene. `widgetValueStore.registerWidget`
returns that proxy (not the caller's input ref), so `BaseWidget._state`
and every other reader observe the same object. Replace-on-write idioms
would swap the cached proxy on each write and break that stability —
the reactive-identity test in
[widgetValueStore.test.ts](../../src/stores/widgetValueStore.test.ts)
locks in the contract.

### 3.2 SoA / archetype storage

bitECS, koota, and miniplex use sparse-set / archetype storage internally
for cache locality. Our `reactive(Map<EntityId, unknown>)` is closer to
ECSY's AoS — slower iteration but **integrates natively with Vue's
tracking**.

The surface trade-off is performance; the deeper trade-off is identity.
SoA storage spreads each component's fields across parallel typed arrays,
so the per-entity "row object" is reconstructed on read. **A future
migration to SoA would lose the proxy on the row object** — and with it
the shared-reactive-identity contract that `BaseWidget._state` and the
`widgetValueStore` facade rely on. This is a load-bearing constraint, not
just a perf optimization decision.

The contract is pinned in the doc-comment at the top of
[src/world/world.ts](../../src/world/world.ts) — copied here for
proximity:

```ts
/**
 * `setComponent` stores values by reference (no clone). The inner
 * `reactive(Map)` produces a single cached Vue proxy per entity-component
 * pair: every `getComponent` call returns the same proxy, and mutations
 * through it propagate to all readers. Note that the proxy is NOT `===`
 * to the raw object passed to `setComponent` — read through `getComponent`
 * (or a `registerWidget`-style helper that does so internally) and treat
 * that proxy as canonical.
 *
 * `BaseWidget._state` and `widgetValueStore` rely on this stable-proxy
 * invariant. Replace-on-write idioms (koota's `entity.set(...)`,
 * miniplex's `world.add(entity)`) would swap the cached proxy on each
 * write and break the contract; revisiting either consumer is required
 * before changing storage semantics.
 */
```

### 3.3 Auto-generated opaque entity IDs

bitECS and koota assume IDs are opaque numbers — `lastId++`, with no
external structure. miniplex uses plain object references with the same
property.

Our `widgetEntityId(rootGraphId, nodeId, name)` is **deterministic and
content-addressed**. Consumers consistently pass `rootGraph.id`, so a
widget viewed at different subgraph depths shares identity with itself.
Migrating to opaque numeric IDs would break cross-subgraph value sharing —
the same widget at depth 0 and depth 2 would receive different IDs and
diverge.

The contract is pinned in the doc-comment at the top of
[src/world/entityIds.ts](../../src/world/entityIds.ts):

```ts
/**
 * Entity IDs are deterministic, content-addressed, and string-prefix
 * encoded — NOT opaque numeric IDs (cf. bitECS, koota, miniplex).
 *
 * `widgetEntityId(rootGraphId, nodeId, name)` is load-bearing:
 * consumers consistently pass `rootGraph.id` so widgets viewed at
 * different subgraph depths share identity. Migrating to numeric IDs
 * would break cross-subgraph value sharing. See ADR 0008 and
 * widgetValueStore for the canonical keying contract.
 */
```

### 3.4 Substrate-side parent/child relations

Bevy ships `Parent` / `Children` components at the substrate layer; Flecs
ships first-class relations. These are useful when many subsystems need
hierarchical traversal at storage-near speeds.

We treat hierarchical traversal as a domain-layer concern instead. The
only structural relation slice 1 needs is `node → widgets` forward
lookup, expressed as a domain component (`WidgetContainer.widgetIds` in
[src/stores/widgetComponents.ts](../../src/stores/widgetComponents.ts))
and surfaced through `getNodeWidgets()` on the
[widget value store](../../src/stores/widgetValueStore.ts). Reverse
`widget → node` lookup is not modeled in the World at all today —
existing call sites already hold a widget object and read `widget.node`
directly via the `BaseWidget` back-reference, so no substrate-side
parent component earns its keep yet. We may revisit this if multiple
slices need a shared traversal API; until then, keeping hierarchy
domain-local preserves the substrate's "no domain knowledge" property.

---

## 4. When to Revisit

The choices in §3 are deliberate but not eternal. Each has a revisit
threshold.

**SoA / archetype storage.** The break-even point against `reactive(Map)`
iteration is roughly **>10k entities per component** in steady-state hot
paths. ComfyUI's projected widget count through slice 4 stays well under
that. The watch signal is whether a render-loop or solver-loop pass
demonstrably dominates frame time on `entitiesWith(WidgetValueComponent)`
or any successor query — not just micro-benchmarks of `Map.get`.

If we cross that threshold, the migration is non-trivial: SoA loses the
proxy on the row object (see §3.2), so a SoA World must either
reconstruct proxies on read (defeating the perf gain) or move
shared-identity reads back to a domain-side cache. ADR 0008's
"Render-Loop Performance Implications and Mitigations" section already
enumerates the planned mitigations (frame-stable query caches, archetype
buckets, profiling-gated storage upgrades behind the World API).

**Replace-on-write idioms.** Revisitable only if the 40+ extension
ecosystem moves off `BaseWidget._state` shared identity entirely — a
separate, larger slice with explicit cost analysis (re-entry, DOM widget
options.getValue overrides, `linkedWidgets` fan-out,
`useProcessedWidgets` memoization invalidation), out of scope for the
current ADR 0008 implementation.

**Opaque entity IDs.** Revisitable only if the cross-subgraph identity
contract is dropped. Today widget value sharing across subgraph depths
depends on it; slice 2 may extend the same contract to `nodeEntityId`
for spatial reads. Until the product requirement changes, opaque IDs
would be a regression.

**Substrate-side parent/child relations.** Revisitable when ≥2 subsystems
need parent traversal. At one consumer it stays domain-local.

---

## 5. Cross-References

- [ADR 0008 — Entity Component System](../adr/0008-entity-component-system.md)
  for the full target taxonomy and migration strategy.
- [ECS Target Architecture](./ecs-target-architecture.md) for the full
  end-state shape.
- [ECS Migration Plan](./ecs-migration-plan.md) for shipping milestones.
- [Appendix: Critical Analysis](./appendix-critical-analysis.md) for the
  independent verification of the architecture documents.
