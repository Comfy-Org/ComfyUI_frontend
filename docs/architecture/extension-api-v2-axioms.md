# Extension API v2 — Axioms and Theorems (vendored)

> **Source**: `christian-byrne/ComfyUI_frontend-ecosystem` (public) —
> `src/data/knowledge/root/AXIOMS.md`, `axioms-theorems.md`,
> `glossary.md` @ `e856a6de51` (2026-05-22). Authored 2026-05-21 from the
> 2026-05-18 frontend standup and the "Centralized Graph State Package" /
> "Canonical Workflow Source and Run Snapshot Model" RFCs.
> **Status**: design axioms for the **Extension API v2** surface — sixteen
> axioms (A1–A16) plus eight derived theorems (T1–T8).
> **Binding now**: §2 only. Each item there is verified against code on `main`
> and cited.
> **Direction of travel**: §3. A Phase-A surface freeze for a package that does
> not ship yet. **Do not enforce §3 against current code** — several of its
> rules describe the removal of APIs that `main` depends on today.
>
> Vendored per [Canonical Knowledge](canonical-knowledge.md). To refresh, re-read
> the source at a newer SHA, re-verify §2 against code, and update this header.

## 1. Why this is here

The axioms are the objection standard for a class of widget, promotion, and
serialization PRs. They previously lived only in another repository, so a review
comment citing "the axioms" could not be checked by the author or by other
reviewers. That is what this file fixes.

Vendoring them unqualified would be worse than not vendoring them: a large part
of the material is a _target_ surface, and an agent that treats it as current law
starts deleting working code. Hence the hard split below.

## 2. Binding now

These hold on `main` today. Treat a diff that breaks one as a defect.

### B1 — A subgraph definition can have many live instances

`SubgraphNode` takes a shared definition by reference
(`readonly subgraph: Subgraph`, `src/lib/litegraph/src/subgraph/SubgraphNode.ts`);
definitions are stored once per root graph (`LGraph._subgraphs`), and an instance
node's `type` is the definition id. `src/types/nodeIdentification.ts` exists
specifically to keep identity stable "across multiple instances of the same
subgraph", distinct from execution ids.

**Obligation**: any design touching subgraph interior state must be exercised
with two instances of one definition, not one. This is already established
practice, not a new rule — see `usePromotedPreviews.test.ts` ("keeps promoted
previews distinct for multiple instances of a shared subgraph definition"),
`workflowFlattening.test.ts` ("collects multiple instances of the same subgraph
type"), and `SubgraphIO.test.ts` ("maintains slot synchronization across
instances").

_(Source: A3; theorems T1, T7.)_

### B2 — A widget value is addressed by a key, not by an object reference

Values live in `widgetValueStore` under a `WidgetId` of the form
`graphId:nodeId:name` (`src/types/widgetId.ts`). A registered `BaseWidget`
aliases the store entry rather than owning a copy (`BaseWidget.value` reads and
writes `this._state`, which `setNodeId` replaces with the store's object).

Three surfaces read the same key concurrently: the Vue node
(`useProcessedWidgets.ts`), the Parameters panel
(`rightSidePanel/parameters/WidgetItem.vue`), and app mode
(`AppModeWidgetList.vue`).

**Obligation**: identify a value by its `WidgetId`. Do not reach for "the"
widget object.

_(Source: A4, A5.)_

### B3 — Widget surfaces converge through shared store state

The current widget surfaces converge through Vue reactivity over one shared
`widgetValueStore` entry: `useProcessedWidgets.ts` reads with `getWidget` and
writes with `setValue`; `rightSidePanel/parameters/WidgetItem.vue` resolves the
same entry; and `AppModeWidgetList.vue` registers or reads that entry. Those
paths contain no separate subscribe/broadcast coordination step
(`src/renderer/extensions/vueNodes/composables/useProcessedWidgets.ts`,
`src/components/rightSidePanel/parameters/WidgetItem.vue`,
`src/components/builder/AppModeWidgetList.vue`).

**Obligation**: a widget surface may not hold state whose correctness depends on
it being the only live view of a value. If two surfaces appear to race, that is a
bug in one of them, not a hazard to defend against with a coordination protocol.

_(Source: theorems T1, T7.)_

### B4 — Promotion creates a new entry; it does not re-key the interior one

Promoting a subgraph input gives the host node its **own** `WidgetId`
(`widgetId(rootGraph.id, subgraphNode.id, name)`, `SubgraphNode`
`promotionUtils.ts`), seeded by copying the interior state
(`seedNestedPromotedInputState`). The interior widget keeps its own key.
Host↔interior agreement is maintained by explicit, named bridges
(`_applyPromotedWidgetValues`, the projected widget's value setter/callback),
not by the two sharing storage.

**Obligation**: never "move" a promoted value by rewriting an id. When host and
interior must agree, write both sides explicitly and say where. Silent one-way
sync is the root cause behind #13601, #14488, and #14495.

_(Source: A5, A11; theorem T6.)_

### B5 — Schema is not rewritten at runtime

`ComfyNodeDefImpl` fields are `readonly` (`src/stores/nodeDefStore.ts`), input
specs flow one way into widget constructors, and `getInputSpecForWidget`
re-resolves the authoritative spec on demand instead of caching a fabricated one
on the widget. A node-def refresh replaces definitions wholesale and updates
`widget.options`, never the spec.

Caveat: this is type discipline and convention, not `Object.freeze`.

**Obligation**: derive from the spec; do not patch it.

_(Source: A5; theorem T2, partial.)_

### B6 — Layout never affects execution

`computeExecutionOrder` is purely link-topological and reads no positions;
`graphToPrompt` emits only `inputs`, `class_type`, and `_meta.title` per node
(`src/utils/executionUtil.ts`). Layout reaches the backend only inertly, inside
`extra_data.extra_pnginfo.workflow`.

**Obligation**: a change that makes execution depend on position, size, collapse
state, or group bounds is a defect.

_(Source: A7; theorem T3, layout half only — see §4.)_

The command-pattern and ECS constraints the axioms also assert (A6, A11) are
already stated for this repo in the root `AGENTS.md` under "Entity Architecture
Constraints (ADR 0003 + ADR 0008)" and enforced by
`.agents/checks/adr-compliance.md`. Those are the local authority; the axioms add
no new obligation there.

## 3. Direction of travel

Useful for understanding where the extension API is going. **Not rules for
current code.** All of this concerns a v2 extension-api package that does not
ship on `main`.

- **A2 — minimal surface.** New extension surfaces are comment-out-by-default;
  restoration needs a validated ecosystem use case, an audit against A1–A13, and
  test coverage.
- **A12 — mount lifecycle as the sole DOM seam.** In v2 there is one widget
  shape reaching DOM only through `mount(host, ctx) → cleanup`; no
  `widget.element`, `widget.inputEl`, `kind: 'dom'`, or `addDOMWidget`. Distinct
  **Remount** (same instance, new host, state survives) and **Recreate** (fresh
  instance from schema, state does not) hooks.
- **A13 — single coordinate space.** The public v2 API speaks canvas units only;
  screen-space access is an unsupported escape hatch.
- **A14 — Phase-A surface exclusions.** Two tables: permanently removed
  (`addWidget`, `addDOMWidget`) and deferred (`getWidget`/`getWidgets`,
  `getMode`/`setMode`, slot introspection and connection events,
  `getPosition`/`setPosition`, `getSize`/`setSize`, `getTitle`/`setTitle`,
  `isSelected`, `isHidden`/`setHidden`, `isDisabled`/`setDisabled`,
  `setSerializeEnabled`/`isSerializeEnabled`, the serialize-event `context`
  discriminator and `skip()`). **These describe what the v2 package excludes, not
  what is banned in this codebase.**
- **A15 — widget declarativity.** Every widget originates from a Python
  `INPUT_TYPES` declaration; no runtime widget addition, no frontend-only widget
  concept.
- **A16 — unified serialization target.** Workflow JSON and API prompt payload
  converge on one output; authors cannot opt a widget out of serialization.
- **A1 (bilateral half), A8, A9, A10** — nodes never enumerate widgets;
  extensibility as a meta-goal; least-privilege handles; Vue-3.5-native idioms.
- **Theorems T2, T4, T5, T8** — schema validation at the assignment boundary;
  recreation safety; reversibility completeness; no in-place schema evolution.
  Each is derivable from the axioms but not currently true of `main` (§4).

## 4. Where the axioms do not describe `main`

Recorded so nobody re-derives it, and so nobody "fixes" working code.

| Axiom / theorem             | What it asserts                                           | What `main` does                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A15, A14 REMOVED            | `addWidget` is gone and will not return                   | `LGraphNode.addWidget` exists with ~38 non-fixture call sites in `src/`, is exercised by e2e via `window.app`, and is relied on by custom nodes                                                                                                                                                                                                |
| A12, A14 REMOVED            | no `addDOMWidget`, no `widget.element`                    | `addDOMWidget` is a prototype patch in `src/scripts/domWidget.ts` with 7 call sites, carries an explicit custom-node compat workaround (#2493), and `widget.inputEl` is maintained as a deprecated alias                                                                                                                                       |
| A15                         | no "frontend-only widget" concept                         | `control_after_generate`, `control_filter_list`, remote-combo refresh buttons, preview/progress widgets, upload buttons, and the dynamic-input `'shim'` widget are all frontend-created with `serialize: false`; `app.ts` synthesizes defs for frontend-only nodes                                                                             |
| A16                         | workflow JSON ≡ prompt payload                            | `graphToPrompt` returns two different artifacts with different schemas (`zComfyWorkflow` vs `zComfyApiWorkflow`), shipped in different fields of the `/prompt` body. Two independent opt-outs exist — `widget.serialize` (workflow) and `widget.options.serialize` (prompt) — see `docs/WIDGET_SERIALIZATION.md`                               |
| T3                          | value mutation cannot change topology                     | `src/core/graph/widgets/dynamicWidgets.ts` redefines a combo's value setter to add/remove/splice node inputs and relink. Real, deliberate, and the store write path (`widgetValueStore.setValue`) bypasses it — the two write paths disagree                                                                                                   |
| T4                          | widget recreation is the lifecycle for host moves         | DOM widget hosts **reparent** the existing element (`DomWidget.vue`, `WidgetDOM.vue` both guard with `contains()` then append), and `createCopyForNode` shares the element deliberately. `main` does remount, not recreate                                                                                                                     |
| T5                          | every mutation is a replayable command                    | Layout callers write `layoutStore` directly (`useNodeDrag`, `useVueNodeResizeTracking`, `syncLayoutStoreFromGraph`), and slot/link/reroute layout writes have no mutation-API equivalent or operation record                                                                                                                                   |
| A11 "plain data components" | components carry no methods and no parent back-references | `domWidgetStore` stores live widget instances holding `readonly node: LGraphNode` and methods; `subgraphNavigationStore` holds a live `Subgraph`; `nodeOutputStore` takes `LGraphNode`/`SubgraphNode` across its API. `layoutStore` is a singleton class, not a Pinia store. Only `widgetValueStore` and `previewExposureStore` are plain data |
| A13                         | one coordinate space with conversion at the boundary      | The intent holds but there is no stated policy and three different conversion mechanisms coexist (`transformState.screenToCanvas`, `clientPosToCanvasPos`, and a hand-rolled DOM-rect scale in `useSlotElementTracking.ts` that exists because `lgCanvas.ds` can diverge from the CSS transform)                                               |

Note also that ADR 0003 and ADR 0008 — the local statements of A6 and A11 — are
both status **Proposed**. They are direction with teeth (`.agents/checks`
enforces them on new code), not a description of the whole codebase.

## 5. Terms

Widget, Value, Schema, Props, Topology, Promotion, Entity, Component, System,
Handle, Mount, Recreate, Remount, Blueprint and the rest are defined in
[Domain Glossary](domain-glossary.md). Use those definitions; do not re-coin
them in a review thread.
