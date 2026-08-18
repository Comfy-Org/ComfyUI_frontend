# Appendix: ECS Pattern Survey

> **Superseded (PR 12617).** The single `src/world/` substrate this appendix
> analyzes was removed; the project adopted dedicated Pinia stores
> (`widgetValueStore`, `domWidgetStore`, `layoutStore`, `nodeOutputStore`,
> `subgraphNavigationStore`, `previewExposureStore`) keyed by string IDs. §1
> (the external library survey) remains valid reference material and supports
> the dedicated-store direction — its first unanimous finding, that components
> live with the code that owns them, is exactly what per-domain stores do. §2–§4
> describe the deleted `src/world/` substrate (`world.ts`, `entityIds.ts`,
> `widgetComponents.ts`, `WidgetEntityId`) and are retained for historical
> rationale only; read their references to "the World" as "the relevant
> dedicated store."

_A survey of mainstream Entity Component System libraries — bitECS, miniplex,
koota, ECSY, Thyseus, and Bevy. This appendix records which structural patterns
the surveyed libraries share, which the project departs from, and where the
trade-offs carry weight. Thyseus is called out specifically because it is the
most Bevy-shaped of the TypeScript ECSs surveyed — its `Commands` parameter is
the closest external analog to the command layer ADR 0003 / ADR 0008 converge
on, so it gets dedicated treatment in §2.5 and §3.5._

---

## 1. Survey Comparison

Six libraries were sampled for structural patterns: where component
definitions live relative to the substrate, how components are declared,
how entities are identified, and roughly how large the substrate's public
surface is. Sources: the linked READMEs and docs.

| Library                                            | Component placement                  | Component definition style                     | Entity ID type       |                                                 Approx. # core exports |
| -------------------------------------------------- | ------------------------------------ | ---------------------------------------------- | -------------------- | ---------------------------------------------------------------------: |
| [bitECS](https://github.com/NateTheGreatt/bitECS)  | Outside the substrate; user's choice | plain arrays / objects                         | `number` (unbranded) |                                                                    ~12 |
| [miniplex](https://github.com/hmans/miniplex)      | Colocated with the `Entity` type     | properties on a TS type                        | plain object ref     |                                                                     ~5 |
| [koota](https://github.com/pmndrs/koota)           | Colocated with the consumer          | `trait({...})` factory                         | numeric `.id()`      |                                                ~15 (core) + ~8 (react) |
| [ECSY](https://github.com/ecsyjs/ecsy)             | User's choice                        | `class extends Component`                      | `Entity` object      |                                                                    ~10 |
| [Thyseus](https://github.com/JaimeGensler/thyseus) | Colocated with the consumer          | plain ES6 `class` (instances stored as values) | numeric (via handle) | ~25 (`World`/`Schedule`/`Query`/`Commands`/filters/`Resource`/`Event`) |
| [Bevy](https://bevyengine.org/) (Rust, for shape)  | Plugin-owned (industry std)          | `#[derive(Component)] struct`                  | `Entity(u64)`        |                                                                    n/a |

Two structural patterns are unanimous across the surveyed libraries:

1. **Component definitions live with the code that owns the data**, not
   inside the substrate package. Whether by explicit recommendation
   (Bevy plugins, koota's colocation guidance, Thyseus's
   `import { Position, Velocity } from './components'` convention) or by
   default (bitECS, miniplex), no surveyed substrate ships pre-defined
   component types.
2. **Substrate surface area is small** — bitECS at ~12 exports, koota at
   ~15, miniplex at ~5. ECSY and Thyseus are the outliers: ECSY exposes a
   wider class hierarchy, and Thyseus exposes a broader Bevy-shaped
   surface (Commands, Schedules, Resources, Events, filter combinators)
   because it commits to a full system-execution runtime, not just
   storage.

The dedicated-store end state — each store a small, focused module keyed by a
string ID — sits squarely in this band: a small surface per store, with
component shapes defined next to the store that owns them.

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
`.id()`, and Thyseus hands back a numeric handle wrapped in `Commands`
APIs. Our `Brand<T, Tag>` over each entity kind enables the type-level
cross-kind isolation assertion in
[world.test.ts](../../src/world/world.test.ts) and documents slice-2/3/4
entity kinds at compile time.

This is a deliberate departure rather than an accident. It earns its keep
once `Position` lands on `NodeEntityId | RerouteEntityId` (slice 2) and
`Connectivity` lands on `SlotEntityId` (slice 4); without brands, those
component-key declarations would accept any numeric ID and silently allow
cross-kind misuse.

### 2.5 Commands pattern (Thyseus / Bevy) — direction we are converging on

Thyseus mutates the World exclusively through a `Commands` system
parameter:

```ts
export function spawnEntities(commands: Commands) {
  commands.spawn().add(new Position()).add(new Velocity(1, 2))
}
```

`commands.spawn()`, `.add(component)`, and `.remove(component)` enqueue
deferred mutations against a command buffer; the substrate applies them at
defined sync points in the schedule. This is the same shape Bevy uses
and is the closest direct external analog to the per-store mutation layer
[ADR 0003](../adr/0003-crdt-based-layout-system.md) describes for this
codebase (realized as store mutation APIs such as `useLayoutMutations()`).

We deliberately match the **shape** of this pattern: external callers
submit commands; only the executor calls the World's imperative
`setComponent` / `deleteEntity`. ADR 0008 §"Relationship to ADR 0003"
spells this out, and the parallel with Thyseus is intentional — when we
extend slice 1 with a command executor, the public seam will look much
more like Thyseus's `Commands` than like koota's `entity.set(...)` or
bitECS's `addComponent(world, ...)`.

What we deliberately do **not** copy from Thyseus's commands surface,
yet:

- **Deferred buffering with schedule sync points.** Thyseus batches
  commands and flushes them at well-defined frame phases for archetype
  efficiency. Our command executor stays synchronous in slice 1 because
  Vue reactivity wants writes to be observable in the same microtask,
  and we have no archetype churn cost to amortize.
- **Auto-injected `Commands` parameter.** Thyseus's runtime inspects
  system signatures and injects `Commands`, `Query<...>`, `Res<...>`,
  etc. We do not have a system-runner yet (see §3.5), so commands today
  are called through a plain executor module rather than constructor
  injection.

The point of calling Thyseus out separately is that when ADR 0008 lands
its command executor slice, "what does this look like in Thyseus?" is a
comparison point worth taking seriously. Diverging from the
Bevy/Thyseus shape there should require an explicit justification rather than
silent drift.

---

## 3. Patterns We Explicitly Do NOT Adopt

Each of the following is a real industry idiom we considered and rejected
on structural grounds. None of these are pure performance trade-offs.

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

bitECS, koota, miniplex, and Thyseus use sparse-set / archetype storage
internally for cache locality — Thyseus is explicitly archetypal and
sells "lean memory use and cache-friendly iteration" as a headline
feature. Our `reactive(Map<EntityId, unknown>)` is closer to ECSY's AoS
— slower iteration but **integrates natively with Vue's tracking**.

The surface trade-off is performance; the deeper trade-off is identity.
SoA storage spreads each component's fields across parallel typed arrays,
so the per-entity "row object" is reconstructed on read. **A future
migration to SoA would lose the proxy on the row object** — and with it
the shared-reactive-identity contract that `BaseWidget._state` and the
`widgetValueStore` facade rely on. This constraint carries real weight
beyond a perf optimization decision.

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
 * `widgetEntityId(rootGraphId, nodeId, name)` carries real weight:
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

### 3.5 Thyseus-style system runner, schedules, and worker threads

Thyseus ships a full execution runtime alongside its storage:

- **System functions as units of work**, written as plain functions
  whose parameters (`Commands`, `Query<[Position, Velocity]>`,
  `Res<Time>`, `Maybe<Velocity>`, `With<Active>`, `Without<Frozen>`)
  describe the data they read and write.
- **Schedules** (`class SetupSchedule extends Schedule {}`,
  `world.runSchedule(SetupSchedule)`) name groups of systems and control
  ordering / frequency, including fixed-update patterns.
- **Boilerplate-free worker threads** for running disjoint systems in
  parallel without `eval()`.
- **Builder `World`** assembled imperatively
  (`new World().addSystems(SetupSchedule, spawnEntities).prepare()`).

We deliberately do not adopt any of this in slice 1. The reasons:

1. **Vue already owns scheduling.** Reactivity-driven recomputation,
   `watch`, and component render passes are how work runs in this
   codebase. Inserting a parallel system scheduler would mean every
   piece of work has two possible execution contexts, and consumers
   would have to know which one applies. ADR 0008's planned executor is
   a thin command-application layer, not a fixed-step ECS schedule.
2. **No parallelism budget to spend.** Worker-thread parallelism pays
   off when systems are CPU-bound and clearly data-disjoint. ComfyUI
   frontend's hot paths are render and DOM-bound; the cost of marshaling
   state across threads would dwarf any gain at our entity counts.
3. **Constructor-style parameter injection has a real DX cost.**
   Thyseus's `Query<[Position, Velocity]>` injection requires the
   runtime to introspect and resolve types at registration time. That
   couples every system to the runner. The plain-function +
   `world.getComponent` shape we use today stays trivially testable
   without a `World` fixture.

Revisitable if (a) we end up running solver-style passes that are
clearly CPU-bound and disjoint, or (b) the command executor grows enough
phase ordering that an explicit schedule abstraction earns its keep over
ad-hoc call sites. Until then, "Thyseus has a scheduler so we should
too" is not a sufficient argument — the slice-1 substrate intentionally
stops at storage + identity.

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

**Thyseus-style system runner / schedule / worker threads.** Revisitable
only when the command executor grows multiple explicit phases that have
to be ordered against each other, or when a profiled CPU-bound, clearly
data-disjoint pass shows worker-thread parallelism would pay for the
marshaling cost. Until both of those conditions land in a real ticket,
keep the substrate at storage + identity and let Vue own scheduling.

---

## 5. Cross-References

- [ADR 0008 — Entity Component System](../adr/0008-entity-component-system.md)
  for the full target taxonomy and migration strategy.
- [ECS Target Architecture](./ecs-target-architecture.md) for the full
  end-state shape.
- [ECS Migration Plan](./ecs-migration-plan.md) for shipping milestones.
- [Appendix: Critical Analysis](./appendix-critical-analysis.md) for the
  independent verification of the architecture documents.
