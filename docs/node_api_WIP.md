> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> A working design artifact living on `benjcooley/magic-patch` so it is version
> controlled and reviewable alongside the code it describes. It is **not** a
> finished document and is not intended to land on `main` in this form. When the
> design settles, the durable parts become a proper ADR under `docs/adr/` and
> this file goes away.

# The published custom-node API

**Status:** working design artifact. Companion to `magic_patch_WIP.md` — this is
its step 1. Nothing else in that document is buildable until this exists.

**Constraint:** functions and closed proxy objects only. **No internal frontend
object is reachable from this surface** — not `LGraphNode`, not `LLink`, not a
widget instance, not a Pinia store, not a Vue reactive proxy, not a constructor.

> ### ⚠ This document specifies more than `src/platform/nodeApi/` implements
>
> **Do not convert a pack against a section marked ⛔.** Doing so produces code
> that references a member that does not exist. That has happened twice: one
> conversion used a selector shape the registry rejects, another called
> `setSizeConstraints` from §4a. Both read as successful.
>
> The authority on what exists is `CAPABILITIES` in `comfyApi.ts`, enforced by
> the `no-unknown-api-members` conformance check against the generated
> `apiSurface.ts`. Sections below carry a status marker:
>
> |     | Meaning                                                 |
> | --- | ------------------------------------------------------- |
> | ✅  | Implemented, tested, in `CAPABILITIES`                  |
> | ⛔  | Specified only — a pack needing it is an `api-gap` punt |
>
> **Implemented (v1.0):** `backend`, `commands`, `defs.define`,
> `defs.extend`, `defs.typeCompatibility`, `execution.node`, `graph.nodes`,
> `graph.selection`, `interaction.nodeDragEnd`, `interaction.nodeMoved`,
> `interaction.state`, `node.changeScope`, `node.connectVeto`,
> `node.geometry`, `node.menu`, `node.onPreview`, `node.onSerialize`,
> `node.resolve`, `node.sizeConstraints`, `serialization.control`,
> `settings`, `slots.connect`, `slots.dynamic`, `slots.identity`,
> `slots.moveLinks`, `slots.retype`, `slots.widgetConfig`, `storage`,
> `ui.sidebarTab`, `viewport.changed`, `widgets.canvas`, `widgets.create`,
> `widgets.hidden`, `widgets.mount`, `widgets.reorder`,
> `widgets.typeContext`, `workflow.open`, `workflow.textReplacements`.
>
> **Specified only:** §4a declarative decorations (badges/anchors — note
> `setSizeConstraints` and `widgets.canvas` DID ship), §4b chrome, §4c
> `onChange`, `graph.replaceNode`, `batch`.

---

## 1. Completeness criterion

An API is "done" when it's neither speculative nor short. The census gives us an
objective test:

> **Every surface custom nodes actually use must have exactly one documented
> destination here.**

| Census surface                            | Packs    | Destination                                                            |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `widgets_splice`                          | 286      | `node.widgets.reorder()` / `.remove()` / `.move()`                     |
| `widget_type_write`                       | 270      | `widget.hidden` (this was the hack's real intent)                      |
| `converted_widget`                        | 238      | `widget.hidden` + `input.isWidgetInput`                                |
| `widgets_assign`                          | 226      | `node.widgets.reorder()`                                               |
| `widgets_push`                            | 142      | `node.widgets.add()`                                                   |
| `hook_getCustomWidgets`                   | 91       | `comfy.widgets.register()`                                             |
| `out_links_write`                         | 58       | `output.connectTo()` / `output.disconnect()`                           |
| `link_endpoint_write`                     | 36       | `output.connectTo()` / `input.disconnect()`                            |
| `node_shape_write`                        | 27       | `node.shape` (enum)                                                    |
| `slot_spread`                             | 23       | `input.snapshot()` — plain frozen object                               |
| `in_link_write`                           | 21       | `input.disconnect()` / `input.source()`                                |
| `type_write_nodevar`                      | 11       | **none — deliberately.** `type` is identity; use `graph.replaceNode()` |
| **canvas draw hooks**                     | **420**  | Four destinations — §4a. Only ~53% is drawing at all                   |
| **`beforeRegisterNodeDef`**               | **1265** | `defs.extend(selector, fn)` — §4d. **47.4% of installs**               |
| `nodeType.prototype.*`                    | 1191     | `NodeDefBuilder` behaviour hooks — §4d                                 |
| `extends LGraphNode` / `registerNodeType` | 86       | `defs.define()` — §4d                                                  |
| `onExecuted`                              | 497      | `onExecuted(node, result)` — §4d                                       |
| `applyToGraph` (virtual nodes)            | 10       | `resolve(ctx)` against a prompt draft — §4d                            |

Eighteen surfaces, eighteen answers. Anything not on this list is out of scope until
a pack demonstrably needs it — the future problem gets solved when it has a shape.

### The painting surface is bigger than expected

Measured over the corpus (`grep`, so a candidate count with a known false-positive
rate — sample-verify before citing):

| Hook                                                     | Packs   |
| -------------------------------------------------------- | ------- |
| `onDrawForeground`                                       | 343     |
| `onDrawBackground`                                       | 169     |
| `onDrawTitleBar`                                         | 14      |
| `onDrawTitleBox` / `onDrawTitleText` / `onDrawCollapsed` | 6 each  |
| **distinct packs painting anything**                     | **420** |

**420 packs / 34,299,457 downloads / 32.2% of registry installs** — comparable to the
entire vue-only widget cohort, and it includes essentially every major pack: kjnodes,
rgthree, easy-use, VideoHelperSuite, impact-pack, custom-scripts, LayerStyle,
cg-use-everywhere, mxtoolkit.

This cannot be written off as a capability loss. It's a third of the ecosystem.

---

## 2. Access and versioning

### The version number

**`major.minor`. No patch component.**

|           | Meaning                                         | May break a pack? |
| --------- | ----------------------------------------------- | ----------------- |
| **major** | something was removed, or its behaviour changed | yes               |
| **minor** | something was added                             | no                |

A patch component would describe a change that is neither — which needs no
announcement, and only tempts packs into comparing on it. Fine-grained detail
belongs in capabilities, not in the number.

**The promise, within a major:** nothing is removed, nothing changes behaviour,
and every addition is discoverable at runtime. That promise is the entire reason
this surface is worth migrating onto — and it is exactly the promise the current
situation broke.

### Capabilities are the contract, not the version

```ts
comfy.version // '1.0' — for logging and bug reports
comfy.major // 1     — breaking-change generation
comfy.supports('widgets.reorder') // boolean, cheap, never throws
comfy.require('widgets.reorder') // throws a named, actionable error
comfy.capabilities() // everything this host provides
```

Packs should branch on `supports()`, not on `version`. A capability survives
being backported to an older line or shipped a minor earlier or later than
planned; a `version >= 1.3` comparison silently breaks in both cases. The
version exists so a bug report is legible, and so `require()` can say _when_:

```
This ComfyUI frontend does not support 'node.decorations'. API version is 1.0;
'node.decorations' requires 1.2. Guard with comfy.supports('node.decorations')
to degrade gracefully.
```

That message is the difference between an actionable report and
`undefined is not a function`. Planned-but-unshipped capabilities are registered
precisely so the error can name a version.

### Supporting several frontends from one pack

This is the constraint that actually governs adoption. **Authors do not refuse
to migrate because migration is hard — they refuse because migrating strands
users on older frontends.** So the pattern must be first-class:

```js
import { comfy } from '/comfy/api/v2.js'

if (comfy.supports('widgets.reorder')) {
  node.widgets.reorder(['prompt', 'seed'])
} else {
  legacySplice(node) // old path, still shipped
}
```

One build, both hosts, no version table. Combined with the dual-web-dir
convention (`docs/magic_patch_WIP.md` §7), a pack can also ship two whole trees and let
the backend pick — with the API major as the natural negotiation signal.

### Every major stays supported

**No major is ever withdrawn.** v1 keeps working when v2 ships, and when v3
ships. A pack written once against v1 runs indefinitely.

That is a strong promise, and it is affordable only because of how a major is
built: **a major is a spec, not a fork.** Each one is a declarative mapping from
public names onto whatever the internals currently are, sharing a single engine
— the proxy factory, slot resolution, the collections. Adding a major adds a
mapping; it does not freeze internals, duplicate logic, or pin us to an old
implementation.

```
/comfy/api/v2.js   ┐
/comfy/api/v2.js   ├─ different specs, one engine, current internals
/comfy/api/v3.js   ┘
window.comfy       ← latest major, for the console
comfy.forMajor(1)  ← pin explicitly
```

The cost is therefore not ongoing maintenance. It is the day an old major's
semantics become genuinely **inexpressible** against current internals — when
some concept it exposed no longer has any equivalent. That is the case to watch,
and the reason majors should be **rare and batched**: collect breaking changes
and ship them together. `node.type` immutability, removing `input.link` /
`output.links`, and the hook rewrite (§5) all belong to the _same_ major, not
three.

Deletion of the old _internal_ surfaces still happens — that is the point of the
programme. What survives is the _published_ one.

### Cross-major identity — the same node has two proxies

A consequence that must be designed for rather than discovered: **handles from
different majors, or different API instances, are different objects.** One
object cannot have two shapes. So:

```js
a === b // false, even for the same node
comfy.sameEntity(a, b) // true — this is the supported comparison
comfy.adopt(foreign) // re-resolve a foreign handle into this instance
```

This matters because packs pass handles to each other through hooks. Every
handle carries `{ kind, id }` under `Symbol.for('comfy.handle')` — readable by
any major, exposing nothing internal, and invisible to `Object.keys`, spreads
and `JSON.stringify`.

Rules of thumb, worth stating in the pack-facing docs:

- `===` is reliable **only** for handles you obtained yourself, from one instance.
- Any handle that arrived from elsewhere — a hook argument, another pack —
  should be compared with `sameEntity` and converted with `adopt`.

Note this bites even _within_ one major: two API instances mint separate
proxies. The token makes identity correct regardless of how many instances or
majors exist, which is why it is the mechanism rather than "just use one
instance".

### What a major bump costs

Two live specs, two test surfaces, and a compatibility obligation that never
expires. Cheap per-major, but not free — so bump rarely, batch aggressively, and
prefer adding a capability over changing an existing one.

## 3. Core principles

1. **Handles are ID-backed, not reference-backed.** A handle stores a string id and
   resolves on every access. No stale references, no leak of the live object, no
   retention of deleted entities.
2. **Every mutation is a command.** Setters dispatch through the command layer per
   ADR 0003/0008 — serializable, idempotent, undoable. No handle mutates anything
   directly.
3. **All returned data is inert.** Frozen plain objects or primitives. Never a
   reactive proxy, never a live collection, never a class instance.
4. **Snapshots over live views.** Anything list-shaped returns a frozen array
   snapshot, so iterating while mutating is safe — the exact hazard that made
   `output.links` mutation break.
5. **Closed proxies.** Property access outside the declared surface returns
   `undefined`; `ownKeys` enumerates only the surface. There is no path from a
   handle to an internal object, including via prototype, `constructor`, or
   Vue's `__v_raw`.
6. **Deleted entities fail predictably.** Reads return `undefined`, mutations throw
   `ComfyNodeGoneError`. Never a silent no-op — silent discard is precisely what made
   the current breakage unreportable.

---

## 4. The surface

```ts
// ─── Roots ────────────────────────────────────────────────────────────────

interface Comfy {
  readonly version: string
  supports(capability: string): boolean

  readonly graph: GraphHandle
  readonly widgets: WidgetRegistry
  readonly extensions: ExtensionRegistry
  readonly ui: UiSurface
}

// ─── Identity ─────────────────────────────────────────────────────────────

type NodeId = string & { readonly __brand: 'NodeId' }
type LinkId = string & { readonly __brand: 'LinkId' }
type SlotId = string & { readonly __brand: 'SlotId' }

/** A slot reference is a string (id or name), or an EXPLICIT index.
 *
 *  A bare `number` is deliberately not accepted: index use must be visible at the
 *  call site, because an index is a *position*, not an identity, and it shifts when
 *  slots are added or removed.
 *
 *      output.connectTo(node, 'image')       // by name — preferred
 *      output.connectTo(node, { index: 0 })  // by position — explicit, opt-in
 *
 *  Resolution order for a string ref:
 *    1. exact SlotId
 *    2. exact slot name (undefined if ambiguous)
 *    3. TRANSITIONAL: a canonical integer string resolves positionally, so '0'
 *       means slot 0 while the backend does not yet supply names.
 *    4. undefined
 *
 *  Step 3 is a migration affordance, not a permanent rule. Gate on
 *  `comfy.supports('slots.named')` to know whether names are available. */
type SlotRef = SlotId | string | { readonly index: number }

// ─── Graph ────────────────────────────────────────────────────────────────

interface GraphHandle {
  readonly id: string

  node(id: NodeId): NodeHandle | undefined
  nodes(): readonly NodeHandle[] // snapshot
  nodesOfType(type: string): readonly NodeHandle[]

  add(type: string, init?: NodeInit): NodeHandle
  remove(id: NodeId): boolean

  /** `node.type = x` has no equivalent — type is identity. This is the honest
   *  replacement: build a new node and rewire. Reports what it couldn't carry. */
  replaceNode(
    id: NodeId,
    newType: string,
    opts?: {
      widgets?: Record<string, string> // old name -> new name
      keepPosition?: boolean
    }
  ): { node: NodeHandle; unmapped: { widgets: string[]; inputs: string[] } }

  link(id: LinkId): LinkInfo | undefined
  links(): readonly LinkInfo[]

  /** Batch mutations into one undo step and one re-render. */
  batch<T>(fn: () => T): T

  onChange(cb: (ev: GraphChangeEvent) => void): Unsubscribe
}

// ─── Node ─────────────────────────────────────────────────────────────────

interface NodeHandle {
  readonly id: NodeId
  readonly type: string // identity — see graph.replaceNode()
  readonly exists: boolean

  title: string
  mode: NodeMode // 'always' | 'never' | 'bypass'
  color: string | undefined
  bgColor: string | undefined
  shape: NodeShape // enum — string assignment is rejected loudly
  collapsed: boolean
  pinned: boolean

  readonly position: Readonly<Point>
  readonly size: Readonly<Size>
  setPosition(x: number, y: number): void
  setSize(width: number, height: number): void

  readonly inputs: InputCollection
  readonly outputs: OutputCollection
  readonly widgets: WidgetCollection

  /** Inert plain object. Replaces `{...node}`, which now yields nothing useful. */
  snapshot(): Readonly<NodeSnapshot>

  remove(): void
  onChange(cb: (ev: NodeChangeEvent) => void): Unsubscribe
}

// ─── Slots ────────────────────────────────────────────────────────────────

interface InputCollection {
  readonly length: number

  /** Unified lookup: id, name, or index. Throws on an ambiguous name. */
  get(ref: SlotRef): InputSlotHandle | undefined
  byId(id: SlotId): InputSlotHandle | undefined
  byName(name: string): InputSlotHandle | undefined // undefined if ambiguous
  at(index: number): InputSlotHandle | undefined // explicit positional access

  all(): readonly InputSlotHandle[]
  ids(): readonly SlotId[]
  [Symbol.iterator](): Iterator<InputSlotHandle>

  add(def: SlotDef): InputSlotHandle // def.id optional; generated if absent
  remove(ref: SlotRef): boolean
  reorder(refs: readonly SlotRef[]): void
}

interface InputSlotHandle {
  /** Stable identity. Survives insertion, removal and reordering. Use this to
   *  store a reference to a slot. */
  readonly id: SlotId
  /** Current position. **Volatile** — shifts when other slots are added/removed. */
  readonly index: number
  readonly name: string
  readonly type: string
  label: string | undefined

  readonly isConnected: boolean
  /** Whether this input is the socket form of a widget. */
  readonly isWidgetInput: boolean

  link(): LinkInfo | undefined
  source(): { node: NodeHandle; outputIndex: number } | undefined
  disconnect(): boolean

  snapshot(): Readonly<SlotSnapshot> // replaces `{...input}`
}

interface OutputCollection {
  readonly length: number

  get(ref: SlotRef): OutputSlotHandle | undefined
  byId(id: SlotId): OutputSlotHandle | undefined
  byName(name: string): OutputSlotHandle | undefined // undefined if ambiguous
  at(index: number): OutputSlotHandle | undefined // explicit positional access

  all(): readonly OutputSlotHandle[]
  ids(): readonly SlotId[]
  [Symbol.iterator](): Iterator<OutputSlotHandle>

  add(def: SlotDef): OutputSlotHandle
  remove(ref: SlotRef): boolean
  reorder(refs: readonly SlotRef[]): void
}

interface OutputSlotHandle {
  readonly id: SlotId
  /** Volatile — see InputSlotHandle.index. */
  readonly index: number
  readonly name: string
  readonly type: string
  label: string | undefined

  readonly isConnected: boolean

  /** Frozen snapshot — safe to iterate while disconnecting. */
  links(): readonly LinkInfo[]
  targets(): readonly { node: NodeHandle; inputIndex: number }[]

  connectTo(target: NodeHandle | NodeId, input: SlotRef): LinkInfo | undefined
  disconnect(target?: NodeHandle | NodeId, input?: SlotRef): boolean

  snapshot(): Readonly<SlotSnapshot>
}

/** Plain frozen data. Never an LLink. */
interface LinkInfo {
  readonly id: LinkId
  readonly sourceNodeId: NodeId
  readonly sourceSlotId: SlotId
  readonly targetNodeId: NodeId
  readonly targetSlotId: SlotId
  readonly type: string

  /** Positions at the time of the snapshot. Present for wire-format work and
   *  legacy porting; do not store these across mutations. */
  readonly sourceIndex: number
  readonly targetIndex: number
}

// ─── Widgets ──────────────────────────────────────────────────────────────

interface WidgetCollection {
  readonly length: number
  get(name: string): WidgetHandle | undefined
  at(index: number): WidgetHandle | undefined
  all(): readonly WidgetHandle[]
  names(): readonly string[]
  [Symbol.iterator](): Iterator<WidgetHandle>

  add(def: WidgetDef): WidgetHandle
  remove(name: string): boolean

  /** Replaces splice/assign reordering. Names must be a permutation of names();
   *  a partial list throws rather than silently dropping widgets. */
  reorder(names: readonly string[]): void
  move(name: string, toIndex: number): void
}

interface WidgetHandle {
  readonly name: string
  readonly type: string // identity — see the note on converted-widget below
  readonly exists: boolean

  value: WidgetValue
  label: string | undefined
  disabled: boolean

  /** The documented replacement for the converted-widget hack. Hidden widgets
   *  keep their value and still serialize. */
  hidden: boolean

  readonly serialize: boolean
  options(): Readonly<WidgetOptions>
  setOptions(patch: Partial<WidgetOptions>): void

  onChange(cb: (value: WidgetValue) => void): Unsubscribe
  remove(): void
}

// ─── Custom widget registration ───────────────────────────────────────────

interface WidgetRegistry {
  register(def: CustomWidgetDef): void
  isRegistered(type: string): boolean
}

interface CustomWidgetDef {
  readonly type: string
  defaultValue?: WidgetValue
  serialize?: boolean

  /** DOM widget. Framework-agnostic by design: packs bundle their own Vue since
   *  ADR 0005, so a Vue component from a foreign instance cannot be mounted.
   *  A mount function sidesteps the dual-instance problem entirely. */
  mount?(el: HTMLElement, ctx: WidgetMountContext): Unmount

  /** Classic-canvas rendering. Optional; if absent the widget is DOM-only. */
  draw?(
    ctx: CanvasRenderingContext2D,
    rect: Readonly<Rect>,
    state: WidgetDrawState
  ): void

  hitTest?(point: Readonly<Point>, rect: Readonly<Rect>): boolean
}

interface WidgetMountContext {
  readonly node: NodeHandle
  readonly widget: WidgetHandle
  onValueChange(cb: (v: WidgetValue) => void): Unsubscribe
  setValue(v: WidgetValue): void
}

type Unmount = () => void
type Unsubscribe = () => void

// ─── Extensions ───────────────────────────────────────────────────────────

interface ExtensionRegistry {
  register(ext: ExtensionDef): void
}

interface ExtensionDef {
  readonly name: string

  init?(): void | Promise<void>
  setup?(): void | Promise<void>

  /** Replaces beforeRegisterNodeDef. Receives a *definition builder*, never the
   *  node constructor — handing out the class is the current leak. */
  defineNode?(def: NodeDefBuilder): void

  nodeCreated?(node: NodeHandle): void
  nodeRemoved?(node: NodeHandle): void
  graphLoaded?(graph: GraphHandle): void

  commands?: readonly CommandDef[]
  keybindings?: readonly KeybindingDef[]
  settings?: readonly SettingDef[]
}

interface NodeDefBuilder {
  readonly type: string
  readonly category: string
  readonly inputs: readonly Readonly<SlotSnapshot>[]
  readonly outputs: readonly Readonly<SlotSnapshot>[]

  addWidget(def: WidgetDef): void
  setWidgetOptions(name: string, patch: Partial<WidgetOptions>): void
  hideWidget(name: string): void
  setTitle(title: string): void
  setColor(color: string): void

  /** Per-instance behaviour, scoped to this type. Replaces prototype patching. */
  onCreated(cb: (node: NodeHandle) => void): void
  onConnectionsChanged(
    cb: (node: NodeHandle, ev: ConnectionChangeEvent) => void
  ): void
  onSerialize(cb: (node: NodeHandle) => Record<string, unknown> | void): void
  onDeserialize(
    cb: (node: NodeHandle, data: Record<string, unknown>) => void
  ): void
}
```

### Slot identity — why `SlotId` and not just an index

**An index is a position, not an identity.** It shifts the moment another slot is
inserted or removed, and the packs most affected are exactly the ones doing that:
kjnodes' `SetNode`/`GetNode` retype slots dynamically, rgthree's context switches add
and remove them, VideoHelperSuite rebuilds them. Any index a pack stores across a
mutation is a latent bug, and today the API offers nothing else.

Three ways to address a slot, with an explicit hierarchy:

| Form                   | Stable?                                              | Use for                                                        |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `SlotId`               | ✅ across insert/remove/reorder                      | storing a reference                                            |
| name (string)          | ⚠️ unique for inputs; **not guaranteed for outputs** | readable lookup — the target state                             |
| `{ index: n }`         | ❌ volatile                                          | explicit positional access, opt-in                             |
| `'0'` (integer string) | ❌ volatile                                          | **transitional only** — resolves positionally until names ship |

**Index access stays supported, but never implicit.** A bare `number` is not a
`SlotRef`, so every positional use reads as `{ index: 0 }` at the call site and is
greppable. `at(n)` remains the explicit positional accessor for lookup.

Where the id comes from: explicit via `add({ id })`, otherwise derived from the name
when unambiguous, otherwise generated. Stable for the slot's lifetime either way.

**On name ambiguity:** input names are unique per node, but output names come from
`RETURN_NAMES` and can legitimately repeat — `("IMAGE", "IMAGE")` is valid. So
`byName` returns `undefined` on ambiguity rather than silently picking the first.
Guessing here would produce exactly the kind of silent-wrong-slot bug this API exists
to eliminate.

**Names are not available yet.** The backend does not currently supply slot names,
so today `'0'` is how a pack addresses slot 0 and the transitional rule above carries
it. When names ship, the same call sites move to `'image'` with no structural change
— which is the point of taking a string rather than a number now. Packs that need to
branch can probe `comfy.supports('slots.named')`.

**The tension worth naming.** The wire format stores links positionally
(`origin_slot` / `target_slot` are numbers), and `docs/magic_patch_WIP.md` §5 makes
byte-identical serialization a hard gate. So `SlotId` is **runtime identity, re-derived
on load** — stable within a session, not across save/reload — and serialization stays
index-based.

That's the right trade for now: it fixes the bug class that actually bites (indexes
shifting _during_ a session, from the pack's own mutations) at zero wire-format cost.
Persisting slot ids would need a schema version bump and backend coordination, and
should be a separate decision — see Q8.

---

## 4a. ⛔ Node decorations — replacing canvas painting

### What they are actually doing — measured, not inferred

The hook name is misleading. Extracting and classifying all **2,787 draw-callback
bodies** across the 420 packs:

| What the body actually does              | Bodies | %     | Packs |
| ---------------------------------------- | ------ | ----- | ----- |
| **Draws something**                      | 1,468  | 52.7% | 289   |
| Passthrough / prototype-patch plumbing   | 901    | 32.3% | 198   |
| Layout / size enforcement — _no drawing_ | 178    | 6.4%  | 39    |
| State sync / polling — _no drawing_      | 169    | 6.1%  | 46    |
| DOM element sync — _no drawing_          | 71     | 2.5%  | 37    |

> **47.3% of draw-callback bodies never touch a drawing primitive. 127 packs hook
> the draw callback and never draw at all.**

The draw hook is being used as a **per-frame tick**, because it was the only one
available. Real examples:

```js
// comfyui_inteliweb_nodes — enforcing height, every frame
if (Number.isFinite(desired) && Math.abs(this.size?.[1] - desired) > 1)
  this.size[1] = desired

// ComfyUI_Custom_Switch — polling for group renames, every frame
const titles = (app.graph._groups?.map((g) => g.title) || []).join()
if (this.lastKnownGroupTitles !== titles) {
  this.lastKnownGroupTitles = titles
  rebuildUI(this)
}

// comfyui-ig-motion-i2v — syncing DOM visibility, every frame
node.painter.canvas.wrapperEl.hidden = this.flags.collapsed
```

None of that is drawing. It is **polling in place of reactivity, and per-frame
enforcement in place of layout constraints.** Packs do it because the API offers
neither.

### So the 420 packs need four different things, not one

| Need                                                        | Share | Destination                                                                        |
| ----------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| Prototype-patch plumbing (`orig?.apply(this, arguments)`)   | 32.3% | **Vanishes.** `defineNode` (§5) removes the need to wrap anything                  |
| Genuine decoration — status, badges, borders, previews      | ~40%  | `node.decorations` (below) + `node.chrome` to hide/replace default rendering (§4b) |
| Interactive controls painted by hand (mxtoolkit `Slider2D`) | ~13%  | `widgets.register()` + `mount()` (§4)                                              |
| Reactivity + layout substitutes                             | 15.0% | `onChange` (§4c), `setSizeConstraints` (below)                                     |

This reframes the migration substantially. **A third of the work is deleting
boilerplate that only existed to chain prototype patches**, and another sixth is
replacing polling with subscriptions the API already provides. The genuinely hard
part — hand-painted interactive controls — is roughly an eighth, not the whole 420.

### ⛔ Size constraints — the missing piece the data exposed

39 packs re-assert node size on every frame. That needs a declarative home, or they
have nowhere to go:

```ts
interface NodeHandle {
  /** Declarative, enforced by layout. Replaces per-frame `this.size[1] = h`. */
  setSizeConstraints(c: {
    minWidth?: number
    minHeight?: number
    maxWidth?: number
    maxHeight?: number
    autoHeight?: boolean // size to content — what most of the 39 actually want
  }): void
}
```

`autoHeight` is likely the real intent in most cases: the pack adds a DOM widget of
unknown height and hand-computes the node size to fit it. In a DOM-rendered node that
is just layout, and should require no pack code at all.

### The decorative remainder

What genuinely draws: status text, badges, counts, progress bars, borders and
highlights, background tints, image/output previews, per-slot annotations, and
error/invalid markers (impact-pack draws a red X over an incompatible slot).

### Why declarative, not a DOM mount

The measured vocabulary maps onto CSS exactly — every primitive has a native
equivalent, so "convertible to DOM behaviours that are the same" is literally true
rather than aspirational:

| Canvas (packs using)                                | DOM/CSS equivalent                                               |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `fillText` 326, `measureText` 206                   | a text node — and measurement becomes free, the browser lays out |
| `fillRect` 234 / `roundRect` 193 / `strokeRect` 159 | `background`, `border-radius`, `border`                          |
| `drawImage` 203                                     | `<img>`                                                          |
| `arc` 181 / `ellipse` 58                            | `border-radius: 50%`                                             |
| `translate` 170 / `rotate` 136                      | `transform`                                                      |
| `globalAlpha` 150                                   | `opacity`                                                        |
| `clip` 138                                          | `overflow: hidden`                                               |
| `setLineDash` 115                                   | `border-style: dashed`                                           |
| `shadowBlur` 95                                     | `box-shadow`                                                     |
| `createLinearGradient` 79                           | `linear-gradient()`                                              |

But a DOM mount API would be the wrong shape, for one decisive reason:

> **A declarative decoration can be rendered to _both_ canvas and DOM. A DOM mount
> can only render in Nodes 2.0.**

If packs migrate to a mount API, they must _keep_ their canvas code for classic mode
— so they carry both forever and we can never delete the draw hooks. If they migrate
to declarations, we render them in whichever mode is active, they delete their canvas
code, and the hooks become removable. That is the entire objective of this programme.

It's the same argument as the dual-web-dir convention in `docs/magic_patch_WIP.md` §7:
authors will not adopt something that forces them to drop half their users.

Secondary wins: LOD handling disappears (rgthree hand-rolls a
`canvas.ds.scale < 0.6` check that we do centrally), and decorations can be made to
respect Comfy design standards instead of 420 packs each inventing a badge style.

### The surface

```ts
interface NodeHandle {
  readonly decorations: DecorationCollection // added to §4
}

interface DecorationCollection {
  /** Keyed, so repeated calls update rather than accumulate — the common bug when
   *  porting from a draw callback that ran every frame. */
  set(key: string, dec: Decoration): void
  delete(key: string): boolean
  clear(): void
  keys(): readonly string[]
}

type Decoration = { anchor: Anchor; hidden?: boolean } & (
  | {
      kind: 'text'
      text: string
      color?: Color
      size?: 'sm' | 'md' | 'lg'
      align?: 'start' | 'center' | 'end'
    }
  | {
      kind: 'badge'
      text: string
      color?: Color
      background?: Color
      icon?: IconName
    }
  | {
      kind: 'bar'
      value: number /* 0..1 */
      color?: Color
      background?: Color
      label?: string
    }
  | { kind: 'dot'; color: Color; pulse?: boolean }
  | {
      kind: 'image'
      src: string
      fit?: 'contain' | 'cover'
      width?: Length
      height?: Length
    }
  | {
      kind: 'box'
      fill?: Color
      stroke?: Color
      dashed?: boolean
      radius?: Length
    }
  | { kind: 'border'; color: Color; width?: number; dashed?: boolean }
  | { kind: 'tint'; color: Color; opacity?: number }
)

/** Layout-relative, never pixel coordinates — canvas-space pixels don't survive
 *  DOM layout, and this is what makes one declaration render in both modes. */
type Anchor =
  | 'title-left'
  | 'title-right'
  | 'body-top'
  | 'body-bottom'
  | 'overlay-top-left'
  | 'overlay-top-right'
  | 'overlay-bottom-left'
  | 'overlay-bottom-right'
  | 'below'
  | 'node' // whole-node: border, tint
  | { slot: SlotRef; side: 'input' | 'output' } // rgthree's per-slot status text
```

Usage, replacing the custom-scripts case:

```js
// before — ran every frame, in a prototype patch
nodeType.prototype.onDrawForeground = function (ctx) {
  /* fillText(value) */
}

// after — set when the value changes
node.decorations.set('output-value', {
  kind: 'badge',
  anchor: 'overlay-top-right',
  text: String(value)
})
```

### The escape hatch

Some painting won't be expressible. For that, an explicitly Nodes-2.0-only mount,
with honest semantics rather than a silent no-op:

```ts
interface NodeDefBuilder {
  /** DOM-only. In classic canvas mode this does not render; `fallback` declares
   *  what to show instead. Prefer decorations — this cannot render to canvas. */
  decorate(opts: {
    region: 'body' | 'overlay' | 'below'
    mount(el: HTMLElement, ctx: { node: NodeHandle }): Unmount
    fallback?: Decoration
  }): void
}
```

`fallback` matters: it keeps a migrated pack working in classic mode at reduced
fidelity, instead of silently rendering nothing — which is exactly the failure mode
Nodes 2.0 has today.

### Migration difficulty, honestly

| Class                                                  | Share of bodies         | Mechanical?                                                                            |
| ------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------- |
| Prototype-patch plumbing                               | 32.3%                   | ✅ **deleted outright** — highest-volume, lowest-risk transform in the whole programme |
| Size enforcement → `setSizeConstraints` / `autoHeight` | 6.4%                    | ✅ largely                                                                             |
| Reconcile-on-change → `onChange`                       | 6.1%                    | ✅ near-rename; ⚠️ pick the narrowest event, don't default to `graph.onChange`         |
| DOM visibility sync                                    | 2.5%                    | ✅ handled by widget mount lifecycle                                                   |
| Static text / badge / status                           | large part of the 52.7% | ✅ modulo the frame→event shift below                                                  |
| Slot-anchored text and markers                         | rgthree, impact-pack    | ⚠️ needs the slot anchor; layout maths is discarded, not translated                    |
| Interactive controls                                   | ~13%                    | ❌ becomes a custom widget — substantial rewrite                                       |
| Arbitrary composed graphics                            | tail                    | ❌ escape hatch, or stays canvas-only                                                  |

**The frame→event shift is the trap.** A draw callback recomputes from current state
every frame, so nothing ever needs to announce a change. Declarations must instead be
_set when the value changes_. A naive port that calls `decorations.set()` from the old
callback body will appear to work — and quietly run every frame forever. This is the
single most likely defect in an automated port of this cohort, it will not show up as
an error, and it deserves both a lint rule and a dedicated harness probe.

---

## 4b. ⛔ Chrome control — hide and replace

Decorations are additive. Packs also need to _suppress_ or _substitute_ the node's
own rendering — mxtoolkit paints over the whole body, others replace the title bar or
hide slot rows. Without this, decoration alone can't express what they do today.

The node exposes named regions, and each can be defaulted, hidden, or replaced:

```ts
interface NodeHandle {
  readonly chrome: NodeChrome
}

type Region =
  | 'title'
  | 'title-icon'
  | 'title-text'
  | 'body'
  | 'widgets'
  | 'inputs'
  | 'outputs'
  | 'background'
  | 'border'
  | 'footer'

interface NodeChrome {
  hide(region: Region): void
  show(region: Region): void
  isHidden(region: Region): boolean

  /** Declarative substitution — renders in both modes, like decorations. */
  replace(region: Region, dec: Decoration): void

  /** Escape hatch. DOM-only; `fallback` covers classic canvas mode. */
  mount(
    region: Region,
    opts: {
      mount(el: HTMLElement, ctx: { node: NodeHandle }): Unmount
      fallback?: Decoration
    }
  ): void

  reset(region?: Region): void
}
```

Also available at definition level, which is where most of it belongs — "all nodes of
this type look like this" rather than "this instance does":

```ts
interface NodeDefBuilder {
  chrome: Omit<NodeChrome, 'isHidden'> // defaults for every node of this type
}
```

**Deliberate constraint: `replace` takes a `Decoration`, and `mount` is separate and
flagged.** Replacing a region with arbitrary DOM is how packs re-implement the node
and re-break on every internal change — precisely the coupling this API exists to
end. Declarative substitution stays mode-agnostic and survives our refactors; `mount`
is the acknowledged escape hatch, and its usage is worth tracking as a signal that
the declarative vocabulary is short.

`inputs` / `outputs` as hideable regions deserve care: hiding a slot visually while it
remains connectable is a genuine footgun. Suggest hiding only renders it collapsed,
never changes connectability — visual state must not diverge from graph state, which
is the class of bug the ECS migration was trying to eliminate.

---

## 4c. ⛔ There is no tick — it's `onChange`

**The trigger is the graph changing.** Not a timer, and not a repaint either.

`startRendering()` runs a continuous rAF loop (`LGraphCanvas.ts:2185-2199`), but
`draw()` gates on `dirty_canvas` (`:5079`) — so `onDrawForeground` fires when
something marked the canvas dirty. Packs latched onto that because it was the only
available notification, but the thing they're reacting to is **the graph mutating**.
Repaint was just the messenger, and a noisy one: mouse-move sets `dirty_canvas`
(`:2305`, `:3287`), so today a pack watching for a group rename re-runs its check on
every pointer move.

So no new hook is needed. This cohort migrates onto the `onChange` subscriptions
already in §4 — the design _shrinks_.

### The contract that makes it usable

```ts
interface GraphHandle {
  onChange(cb: (ev: GraphChangeEvent) => void): Unsubscribe
}

interface NodeHandle {
  /** Fires only for changes affecting this node. */
  onChange(cb: (ev: NodeChangeEvent) => void): Unsubscribe
}

interface GraphChangeEvent {
  /** Coalesced. Loading a workflow is ONE event, not 500. */
  readonly kinds: ReadonlySet<ChangeKind>
  readonly nodes: readonly NodeId[]
  has(kind: ChangeKind): boolean
}

type ChangeKind =
  | 'node-added'
  | 'node-removed'
  | 'node-state'
  | 'node-moved'
  | 'node-resized'
  | 'link-added'
  | 'link-removed'
  | 'widget-value'
  | 'group-added'
  | 'group-removed'
  | 'group-state'
  | 'execution'
```

Three properties do the real work:

- **Coalesced per frame, delivered before paint.** Without this, a pack reconciling
  on every mutation is catastrophically slow during workflow load — the exact hazard
  the draw hook accidentally protected them from, since it fired once per repaint
  rather than once per mutation. Coalescing must be the default, not an option.
- **Scoped.** `node.onChange` fires only for that node. Today every node reconciles
  on every canvas repaint regardless of relevance, which in a 500-node graph is
  almost entirely waste.
- **Described.** `kinds` lets a pack early-out in one set lookup instead of
  recomputing state to discover nothing moved.

Validating against the observed cases:

| Real pack behaviour                                      | Destination                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `ComfyUI_Custom_Switch` polls `app.graph._groups` titles | `graph.onChange` → `has('group-state')`                       |
| `UI-Decorators` mirrors link state                       | `node.onChange` → `has('link-added' \| 'link-removed')`       |
| `comfyui-ig-motion-i2v` syncs DOM on collapse            | `node.onChange` → `has('node-state')`                         |
| `inteliweb` re-asserts height                            | `setSizeConstraints({ autoHeight })` — no subscription at all |

All four served, none needing a tick.

### Explicitly not for

- **Animation.** Use a mounted DOM widget with CSS or its own rAF, scoped to that
  element. `onChange` makes no frame-rate guarantee and fires only on change.
- **External polling** (server state, filesystem). Use `setInterval` — genuinely a
  timer concern, and the platform already has one.

### Preferred order

1. `widget.onChange` — narrowest
2. `node.onChange` — scoped to one node
3. `graph.onChange` — structural changes only

### Instrument the coarse end

A pack subscribing to `graph.onChange` and filtering for one `ChangeKind` is telling
us the scoped event it wanted doesn't exist. Worth tracking: it turns "packs are
using the blunt instrument" into a precise list of the events we're missing, so the
API can grow toward the narrow end instead of accumulating coarse subscriptions.

---

## 4d. Definitions — the largest surface of all

Everything above is the _instance_ API. Packs spend most of their time on
_definitions_, and the numbers make this the dominant concern in the whole
programme:

| Surface                                                                                    | Packs     | Downloads      | % installs |
| ------------------------------------------------------------------------------------------ | --------- | -------------- | ---------- |
| **`beforeRegisterNodeDef`**                                                                | **1,265** | **50,399,739** | **47.4%**  |
| `nodeType.prototype.*` patching                                                            | 1,191     | —              | —          |
| Reads `nodeData.input`                                                                     | 158       | —              | —          |
| Authors own node types (`registerCustomNodes` / `registerNodeType` / `extends LGraphNode`) | 86        | 19,362,040     | 18.2%      |

**Nearly half of all installs run a `beforeRegisterNodeDef` hook**, and 1,191 of
those 1,265 packs use it to patch the generated class's prototype. This is bigger
than the widget cohort and the painting cohort combined, and it is the surface that
couples the ecosystem to our internals most tightly.

### What they patch — measured, not guessed

Prototype assignments across the 1,265 packs, litegraph methods only (bundled-library
noise like `_next`, `dispose`, `toString` filtered out):

| Patched method        | Sites | Packs   | Destination               |
| --------------------- | ----- | ------- | ------------------------- |
| `onNodeCreated`       | 3,161 | **943** | `onCreated`               |
| `onExecuted`          | 964   | **497** | `onExecuted`              |
| `onConfigure`         | 1,272 | **429** | `onConfigured`            |
| `onConnectionsChange` | 454   | 223     | `onConnectionsChanged`    |
| `onDrawForeground`    | 446   | 199     | decorations (§4a)         |
| `onRemoved`           | 353   | 158     | `onRemoved`               |
| `constructor`         | 473   | 49      | `onCreated`               |
| `type`                | 310   | 9       | none — identity (§4)      |
| `getDefaultShape`     | 335   | 3       | `setShape` on the builder |

**This corrected a real gap in my draft:** `onExecuted` — 497 packs, the second most
patched method — had no destination. It's how a node receives its execution result
from the backend, and it's the backbone of every preview, readout and result display
in the ecosystem. An API without it is unusable.

### The registry

```ts
interface Comfy {
  readonly defs: DefRegistry
}

interface DefRegistry {
  get(type: string): NodeDef | undefined
  all(): readonly NodeDef[]
  byCategory(category: string): readonly NodeDef[]
  has(type: string): boolean

  /** Replaces beforeRegisterNodeDef. */
  extend(selector: DefSelector, fn: (b: NodeDefBuilder) => void): Unsubscribe

  /** Replaces registerCustomNodes / registerNodeType / `extends LGraphNode`. */
  define(def: NodeTypeDef): void
}

/** Indexed, so a pack's hook runs only for defs it cares about. */
type DefSelector =
  | string // exact type
  | readonly string[] // any of
  | RegExp // type pattern
  | { category?: string; test?(def: NodeDef): boolean }
```

**The selector is not sugar — it's a fix.** Today `beforeRegisterNodeDef` fires for
every registered type in every extension. With 1,265 packs hooking it and a few
thousand node types, boot runs millions of callbacks, nearly all of which
immediately `return` after a type-name check. Making the predicate declarative lets
us index it and invoke only what matches.

### Reading a definition

```ts
interface NodeDef {
  readonly type: string
  readonly title: string
  readonly category: string
  readonly description: string
  readonly inputs: readonly Readonly<InputDef>[]
  readonly outputs: readonly Readonly<OutputDef>[]
  readonly isOutputNode: boolean
  readonly deprecated: boolean
  readonly experimental: boolean
  /** Which pack supplied it — packs use this to scope their own behaviour. */
  readonly source: string | undefined
}
```

Frozen and inert, like every other read in this API. Replaces poking at `nodeData`.

### Modifying a definition

```ts
interface NodeDefBuilder {
  readonly def: NodeDef // current state, post other extensions

  // ── structure ────────────────────────────────────────────────────────────
  addInput(def: SlotDef): void
  removeInput(ref: SlotRef): boolean
  modifyInput(ref: SlotRef, patch: Partial<SlotDef>): void
  addOutput(def: SlotDef): void
  removeOutput(ref: SlotRef): boolean
  modifyOutput(ref: SlotRef, patch: Partial<SlotDef>): void

  addWidget(def: WidgetDef): void
  removeWidget(name: string): boolean
  setWidgetOptions(name: string, patch: Partial<WidgetOptions>): void
  hideWidget(name: string): void

  // ── presentation ─────────────────────────────────────────────────────────
  setTitle(title: string): void
  setCategory(category: string): void
  setColor(color: string): void
  setShape(shape: NodeShape): void
  chrome: Omit<NodeChrome, 'isHidden'> // §4b defaults for this type

  // ── behaviour — replaces prototype patching, ordered by measured usage ────
  onCreated(cb: (node: NodeHandle) => void): void // 943 packs
  onExecuted(cb: (node: NodeHandle, result: ExecutionResult) => void): void // 497
  onConfigured(cb: (node: NodeHandle, data: SerializedNodeExtras) => void): void // 429
  onConnectionsChanged(
    cb: (node: NodeHandle, ev: ConnectionChangeEvent) => void
  ): void // 223
  onRemoved(cb: (node: NodeHandle) => void): void // 158
  onSerialize(cb: (node: NodeHandle) => SerializedNodeExtras | void): void
}

interface ExecutionResult {
  readonly images: readonly Readonly<ImageRef>[]
  readonly text: readonly string[]
  /** Everything else the backend returned for this node, frozen. Custom output
   *  keys survive — the passthrough schema in ADR 0007 guarantees it. */
  readonly raw: Readonly<Record<string, unknown>>
}
```

Two deliberate properties:

- **Multiple packs extending the same type compose.** Today, two packs patching
  `onNodeCreated` chain via `orig?.apply(this, arguments)`, and whether that works
  depends on load order and whether both remembered to call through. Registered
  callbacks compose by construction — which is why 32.3% of draw-callback bodies
  (the chaining plumbing) simply disappear.
- **`onSerialize` returns extras rather than mutating.** Returning data instead of
  writing to a passed object is what keeps serialization deterministic and lets us
  detect two packs fighting over the same key.

### Authoring new node types

86 packs / 18.2% of installs define their own types, today via `extends LGraphNode` —
which ADR 0008 rules out for entity modelling and which is unavailable in a closed
API anyway.

```ts
interface NodeTypeDef {
  readonly type: string
  title?: string
  category?: string
  description?: string

  inputs?: readonly SlotDef[]
  outputs?: readonly SlotDef[]
  widgets?: readonly WidgetDef[]

  /** Frontend-only. Never sent to the backend as an executable node. */
  execution?: 'backend' | 'frontend'

  /** Pure question-answering over a read-only view. See below. */
  resolve?(view: ResolveView): Record<string, OutputResolution>

  onCreated?(node: NodeHandle): void
  onExecuted?(node: NodeHandle, result: ExecutionResult): void
  onConfigured?(node: NodeHandle, data: SerializedNodeExtras): void
  onConnectionsChanged?(node: NodeHandle, ev: ConnectionChangeEvent): void
  onRemoved?(node: NodeHandle): void
  onSerialize?(node: NodeHandle): SerializedNodeExtras | void
}
```

### Virtual nodes — settled design (supersedes the draft-context sketch)

**Status: ✅ decided 2026-08-05, replacing the earlier `PromptResolveContext`
proposal, which handed packs a mutable draft and imperative verbs. Implemented
in `src/platform/nodeApi/resolution.ts`.**

Strip the mechanism away and "virtual node" is four different intents:

| Intent                 | Examples                             | Resolution means                                      |
| ---------------------- | ------------------------------------ | ----------------------------------------------------- |
| **Annotate**           | Note nodes                           | omit from prompt                                      |
| **Be a wire**          | Reroute, kjnodes `SetNode`/`GetNode` | _my output forwards to whatever feeds X_              |
| **Be a value**         | `PrimitiveNode`, constants           | _my output is this literal_                           |
| **Act on other nodes** | rgthree Fast Muter                   | **not resolution** — edit-time commands on neighbours |

The legacy `isVirtualNode` + `applyToGraph()` collapses all four into an
imperative callback that mutates the live graph mid-serialize
(`executionUtil.ts:38` — our own core does this today). Under ECS that is a
system with side effects: not replayable, corrupts the document if it throws
halfway, and syncs phantom mutations under CRDT.

The ECS-consistent mapping:

- **"Virtual" is data, not a class.** `execution: 'frontend'` on the
  definition. The node is an ordinary entity in ordinary stores; it renders
  with the same widget/mount/canvas API as everything else; Nodes 2.0 needs
  nothing special.
- **Resolution is a pure system.** `prompt = resolve(graph)`. The pack never
  touches a draft — it answers a question about its own outputs against a
  read-only view:

```ts
type OutputResolution =
  | { readonly omit: true }
  | { readonly forwardTo: InputRef } // "whatever feeds that input"
  | { readonly literal: WidgetValue }

interface ResolveView {
  readonly self: ResolvedNodeView
  nodesOfType(type: string): readonly ResolvedNodeView[]
}

interface ResolvedNodeView {
  readonly id: string
  readonly type: string
  widgetValue(name: string): WidgetValue | undefined
  input(ref: string | number): InputRef | undefined
}
```

Our pass follows `forwardTo` chains (Get → Set → Reroute → …) to fixpoint
with cycle detection. A resolver that throws poisons that one prompt build;
the graph was never touched — the property `applyToGraph` structurally cannot
have.

- **Nodes that act on other nodes are not virtual-node API.** Fast Muter is a frontend-only
  node whose button callbacks mutate neighbours through handles — which under
  ECS become commands: serializable, undoable, the only legal mutation path.
  Its sole "virtual" property is `execution: 'frontend'`.
- **Core migrates onto the same system.** Reroute and Primitive become the
  first resolvers; `applyToGraph` is then deletable from core. Known external
  consumers to migrate with it: ComfyUI-Custom-Scripts `presetText.js`,
  VideoHelperSuite `VHS.core.js` (named in `litegraph-augmentation.d.ts:122`).

### Migration difficulty

| From                                                 | To                         | Mechanical?                                                 |
| ---------------------------------------------------- | -------------------------- | ----------------------------------------------------------- |
| `beforeRegisterNodeDef` + type-name `if`             | `defs.extend(selector, …)` | ✅ the selector is usually the `if` condition already there |
| `nodeType.prototype.onNodeCreated = …` with chaining | `onCreated(cb)`            | ✅ high volume, low risk — chaining boilerplate deleted     |
| `nodeData.input.required.x` reads                    | `b.def.inputs`             | ✅ shape differs, mapping is total                          |
| `extends LGraphNode` + `registerNodeType`            | `defs.define({...})`       | ❌ real rewrite; 86 packs, but 18.2% of installs            |
| `applyToGraph`                                       | `resolve(ctx)`             | ❌ semantics change from live-graph to draft                |

The first three are the bulk — roughly 1,200 packs of largely mechanical work. The
last two are 86 packs of genuine rewrite, and they include rgthree and kjnodes, which
is another argument for handling the top packs as upstream relationships rather than
automated patches.

---

## 4e. Sample conversions — what real pack code exposed

Converting real files from the corpus, rather than reasoning about the census
counts, found three things the design had wrong or missing. This is the cheapest
validation available and should run before the API is frozen.

### ✅ Win — kjnodes `setgetnodes.js:988`

```js
// before — splice out and back in at the same index, purely to force the
// renderer to re-read the options object. Not a reorder at all.
w.options = newOpts
const idx = this.widgets.indexOf(w)
if (idx >= 0) {
  this.widgets.splice(idx, 1)
  this.widgets.splice(idx, 0, w)
}

// after
node.widgets.get(name).setOptions(newOpts)
```

The hack disappears entirely: invalidation is the API's problem, not the pack's.
Note this instance is counted in the 286-pack `widgets_splice` cohort but is
**not** a reordering — a converter keyed on "splice means reorder" would produce
nonsense here.

### 🐞 Bug found in this API — accessor options

The same pack builds its options with a **live getter**:

```js
Object.defineProperty(
  newOpts,
  'values',
  Object.getOwnPropertyDescriptor(comboOptions, 'values')
)
```

`setOptions` merged with `{ ...w.options, ...patch }`, which **invokes the getter
and freezes its result** — silently pinning every dynamic combo to a one-time
snapshot. Verified, then fixed to a descriptor-preserving merge with a
regression test. Dynamic combos are common (kjnodes `SetNode`/`GetNode`), so this
would have been a widespread, silent, hard-to-attribute breakage.

### ✅ Closed — link retargeting (`moveLinksTo`)

rgthree `power_prompt.js:22` moves every link from output 0 to output 3, keeping
the links themselves:

```js
node.outputs[3].links.push(link)
;(node.graph || app.graph).links[link].origin_slot = 3 // retarget in place
node.outputs[0].links = null
```

The closest expression in the current API is disconnect-and-reconnect:

```js
for (const link of from.links()) {
  to.connectTo(link.targetNodeId, { index: link.targetIndex })
}
from.disconnect()
```

**Which is not equivalent: it allocates new link ids.** Serialized workflows
would differ, failing `docs/magic_patch_WIP.md` §5's byte-identical gate — the one hard
gate in the programme.

Added, and it preserves link ids — the link store patches endpoints in place
(`linkStore.ts:256`), so the serialized workflow is unchanged:

```ts
// after — one call, ids preserved, wire format intact
node.outputs.byName('STRING').moveLinksTo({ index: 3 })
node.outputs.at(0).modify({ type: 'CONDITIONING', name: 'CONDITIONING' })
```

Nine lines of link-surgery become two, and the byte-identical gate holds.

**Deliberately permissive:** `moveLinksTo` does not re-validate slot types,
because the real sequence moves links off an output and _then_ retypes it —
enforcing compatibility mid-move would reject the exact case it exists for. Pinned
by a test so the behaviour is chosen rather than accidental.

### ✅ Closed — slot retype and rename (`modify`)

The same file continues:

```js
node.outputs[0].type = nodeData.output[0]
node.outputs[0].name = nodeData.output_name[0] || node.outputs[0].type
```

Dynamic retyping is exactly what `SetNode`/`GetNode`-style packs do, and §4
originally exposed only `label` as writable.

Added as **one atomic method rather than three setters**, so a retype-plus-rename
is a single command and therefore a single undo step:

```ts
slot.modify({ type: 'MODEL', name: 'model' })
```

Retyping **keeps existing links**. Dynamic retyping (`*` -> `MODEL`) is the whole
point for `SetNode`-style packs, and silently dropping connections is the failure
mode this API exists to end.

### ⚠️ Converter hazard — serialized data looks like live data

easy-use `image_chooser/prompt.js:82`:

```js
p.workflow.nodes.forEach((node) => {
  if (node.id === here_id)
    node.inputs.forEach((i) => {
      i.link = null
    })
})
```

This is flagged by the census as `in_link_write`, but `p.workflow` is a
**serialized prompt payload**, not the live graph. Nulling `link` there is
correct and must not be rewritten.

So a rule matching `.link =` textually will corrupt this file. The converter
needs to distinguish live handles from plain workflow JSON — which is not
decidable by regex, and is a concrete argument for the agent tier being scoped to
exactly this kind of judgment rather than to bulk mechanical edits.

It also confirms the study's warning that L0 counts include false positives:
**every rule needs sampled verification before its autofix is trusted.**

### Contract growth from this exercise

Three methods added, chosen to be the smallest surface that covers the cases:

| Added                     | Why not smaller                                     | Why not larger                                                          |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| `slot.modify(patch)`      | `label` alone could not express retype or rename    | one atomic method instead of three setters — one command, one undo step |
| `output.moveLinksTo(ref)` | no composition of existing calls preserves link ids | only same-node moves; cross-node retargeting has no observed use        |

Rejected as speculative: cross-node link retargeting, slot insertion at an index,
per-link retarget. None appeared in the sampled code, so none is in the contract.

### What this exercise is worth

Four files, one afternoon, and it produced: one confirmed bug in the new API, two
missing capabilities, and one converter hazard that would have silently corrupted
a working pack. **Do this for the top 20 packs before freezing the interface** —
it is far cheaper than discovering the same things after authors have migrated.

---

## 4f. ⚖️ Contested additions — argue with these

Everything here was added because a real pack could not be converted without
it, under time pressure, and every one is arguable. They are collected rather
than scattered so a reviewer can overturn them in one pass.

Each entry states what forced it, what the alternative was, why the alternative
was rejected, and **what it would cost to reverse**. The cost line is the one
that matters: some of these are cheap to withdraw and some are not.

### `node.getScreenRect()` and `comfy.onViewportChanged()`

**Forced by** kjnodes `ideogram4_prompt_builder.js` — a floating dock anchored
to a node. It was the last file holding `window.comfyAPI` open for reasons that
were not gaps: it worked before, so the capability was real.

**The tension.** These are viewport-adjacent, and the standing instruction is
that _how the graph draws_ does not belong in a node API. `comfy.constants` was
removed for exactly that reason.

**Why these are different.** They are the _question_, not the _mechanism_.
`getScreenRect` answers "where is this node on screen"; it does not expose pan,
zoom, or the transform. `onViewportChanged` says "that answer may have changed"
and carries no payload. The arithmetic confirms the distinction: the old
expression was

```
rect.left + (pos.x + offset.x) * scale
```

and the new one is `hostScreen.x + (pos.x - hostGraph.x) * scale` — **the pan
offset and canvas rect cancel out**. The zoom factor is likewise recoverable as
`getScreenRect().width / getBounds().width`, so it never had to be published.

**Alternative rejected.** Exposing `viewport.transform()` (pan + scale). That is
the mechanism, invites packs to re-derive geometry, and is the mistake
`comfy.constants` made.

**Cost to reverse.** Moderate. One pack uses them today. If withdrawn,
node-anchored floating UI becomes unimplementable and ideogram's dock is lost.

### `comfy.storage`

**Forced by** the same file: named caption templates the user authors, kept
server-side via `api.storeUserData`.

**The tension.** Is per-user file storage a _node_ API concern at all? It is not
about nodes, graphs or widgets. A reasonable reviewer could say packs should use
`localStorage` and be done.

**Why it was added.** `localStorage` does not follow a user between machines,
and this is content a user _authored_ — losing it on a new machine is a data
loss, not an inconvenience. `comfy.settings` is the wrong home: that is for
values configured once, not documents.

**Guardrails.** Names must be namespaced, exactly as setting ids are, and `..`
is refused so a pack cannot climb out of its namespace into another pack's data
or the user's own files.

**Cost to reverse.** Low. One pack, one feature.

**Open question.** Should there be a quota, or a way for a user to see and clear
what a pack has stored? Neither exists.

### `b.setExecution('frontend')`

**Forced by** enricos `tools.js`. One line — `node.isVirtualNode = true` on a
**backend-registered** type — was the whole refusal.

**The tension.** This is the most powerful thing added. It lets a pack declare
that a node the _server_ registered will never reach the prompt. Get it wrong,
or apply it to the wrong selector, and nodes silently vanish from execution.

**Why it was added anyway.** The alternative is worse. Without it a conversion
must drop the line, which **adds** a node to `graphToPrompt` that was never
there — a wire-format break rather than a degradation. `defs.define` could
already say this for pack-owned types; `defs.extend` could not say it for
existing ones, which is an asymmetry rather than a safety property.

**Alternative rejected.** `setMode('never')` also keeps a node out of the
prompt, but writes `mode: 2` into the saved workflow and reads to the user as
manual muting. Not equivalent.

**Cost to reverse.** High. Removing it re-refuses the file and leaves no
expressible way to convert a frontend-only tools node.

### `defs.defineWidgetType()`

**Forced by** comfy-mtb (`MTB_COLOR`), rmbg (`COLORCODE`), mtb (`FLOAT_CURVE`).
In mtb it cascaded: one registration blocked four files.

**The tension.** It is a _global type registry_ — a pack claims a type name for
the whole application. Two packs claiming the same name is unresolvable, and the
existing precedent (`widgetStore` spreading core last) silently discards the
loser.

**Why it is not optional.** The host decides widget-vs-socket by a single
lookup, and `addInputSocket` / `addInputWidget` are exact complements on it. An
unregistered type does not degrade to a plain widget — the input becomes a
**socket**, changing the serialized `inputs` array and dropping its
`widgets_values` entry. That is a wire-format break, so "just leave it
unregistered" was never available.

**Known sharp edge, unresolved.** Core still wins a name collision. A pack
registering `COLOR` is silently ignored, which is how three packs' widgets were
found already dead. The published API therefore has a mode where a correct call
does nothing. Fixing that means either failing loudly on collision or letting
packs override core — see §3 of `API_DECISIONS_FOR_REVIEW.md`.

**Cost to reverse.** Very high. Six files across three packs, and no
alternative expression.

### `widgets.mount({ defaultValue })`

**The tension.** `mount` was deliberately for _decoration_, and decoration must
not touch the wire format. Giving it a value blurs that line.

**Why it was added.** Packs mount value-holding controls — colour pickers, text
boxes, vector editors — because that is what `addDOMWidget` was. Without a
value cell those controls kept their `widgets_values` slot and **silently lost
what the user typed**. mtb's `Constant` node was saving `''` for its colour,
string and vector inputs. This was the root cause of most of the wire deltas
reported during conversion.

**How the line is held.** A mount is decoration _unless_ it declares
`defaultValue`. Serialization follows that: a control that holds a value is
saved and sent, a drawing is not, and the pack's explicit `serialize` still
wins either way.

**Cost to reverse.** High, and it would reintroduce silent data loss.

### `node.getBounds()`, `node.getSlotPosition()`, `graph.nodeAt()`

**Forced by** retiring `comfy.constants`. Every use of that was a pack
reimplementing editor hit-testing and slot layout from raw metrics.

**The tension.** Geometry is renderer-owned, and these publish it.

**Why they are better than what they replaced.** They route to the renderer's
own answers, so they stay correct for collapsed nodes, widget-backed inputs and
Nodes 2.0 — all cases the `(index + 0.7) * slotHeight` reconstruction got wrong.
The converted `utility.js` admitted as much in a comment before this existed.

**Deliberate omission.** `nodeAt` answers against the _rendered_ layout and is
not refreshed per call: a gesture asks it on every pointer move, and remeasuring
every node each time is the expensive mistake. Before the first frame it finds
nothing. This is documented on the method.

**Cost to reverse.** High — five kjnodes files, and the alternative is
`comfy.constants`, which was removed on instruction.

### `DefSelector` accepts a predicate

**Forced by** pysssss `quickNodes.js` — a menu entry for "any node taking a VAE
input", which is a _shape_, not a name.

**The tension.** This partially undoes the reason selectors are declarative.
§4d opens by arguing that a name check can be indexed while today's hooks run
for every registered type, "millions of wasted callbacks at boot". A predicate
has to run per type, which is the cost the design set out to remove.

**Why it was added.** The alternative is worse in the same dimension: without
it, a pack registers a `/./` catch-all and does the shape test inside the
callback — which is _exactly_ the run-and-return pattern, plus a callback
invocation. The predicate at least lets the host see the test and, in future,
index or memoise it.

**Guardrail.** It is documented as discouraged and listed last, and the doc
comment names the only case it is for. If it starts appearing in place of a
name, that is a signal the selector vocabulary is missing something.

**Cost to reverse.** Low today — one pack, and it degrades to a catch-all with
an internal guard.

### `graph.duplicate()`

Uncontested and listed only for completeness. `add(type)` makes a fresh node, so
a pack duplicating a _configured_ node — a prompt box the user has filled in —
lost its contents; pysssss's "Add 2nd Pass" dropped a menu entry rather than
lose the user's text. Links are deliberately not copied: a duplicate wired into
the same places is a different operation.

### The pattern worth noticing

Four of these six exist because **the wire format has no safe failure mode.** A
missing capability does not degrade a pack, it changes what the user's saved
workflow contains — a socket where a widget was, a node appearing in the prompt,
a value silently emptied. That is why the refusals were refusals rather than
partial conversions, and why the fixes could not wait for a design round.

If any of these are overturned, the packs concerned should be **re-refused**,
not converted with a warning.

### Later additions — each reverses a position this document previously took

These arrived after the six above, from re-reading Christian's `ext-api/i-*`
branches. Each one contradicts something stated earlier here, so they need
arguing with on their own terms.

**`widget.on('beforeSerialize')` — reverses "nothing can supply a value".**
§4f and the gap list both said a static `serialize` flag can only _suppress_.
That was wrong: `executionUtil` has been calling `widget.serializeValue` the
whole time, so the prompt-side mechanism already existed and was simply
unpublished. The event shape is taken from their `NodeBeforeSerializeEvent`,
which is better than what we would have invented — it carries a `context`, and
the packs genuinely want to write different values to different destinations.
Ours is wired where theirs is not, and we added a third context they lack:

| context      | destination                                                      | why it is separate                                                                                                                                                              |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'workflow'` | the file a user saves                                            |                                                                                                                                                                                 |
| `'prompt'`   | the queued API payload                                           | already reachable via `serializeValue`                                                                                                                                          |
| `'embedded'` | the workflow copy inside the prompt, written into the output PNG | built by the _same_ `graph.serialize()` as a save, so without this a pack must choose between corrupting the saved file and shipping an image that cannot reproduce its own run |

The workflow half needed a new litegraph hook (`serializeWorkflowValue`), since
`serializeValue` is consulted only by the prompt builder. **Note this collides
head-on with their axiom A16**, which collapses the transports and says
extensions "cannot branch on the transport". If A16 stands, this is re-decided
and every mounted-widget conversion is revisited.

**Supply-side resolution — reverses "demand-side only".** §4 stated resolution
answers only "what feeds me". Broadcast packs are the mirror image, and no
amount of cleverness expresses them demand-side: `resolveFrontendNodes` never
even iterates a node with no outputs. `Supplier` returns an edge list, following
their `resolveConnections` shape, which is the one place their design beats ours
outright. Three constraints, all deliberate and all arguable:

- `from` is the supplier's own output, its own input (`forwardInput`), or a
  literal — never an arbitrary node. A node may only offer what it has, so a
  buggy pack cannot rewire two bystanders to each other.
- First supplier in graph order wins a contested input. cg-use-everywhere
  instead sorts by `priority` and on a tie connects _nothing_ and reports an
  ambiguity; first-wins turns a reported clash into a silent arbitrary choice.
  **Known shortfall, not a decision I am confident in.**
- The pass walks top-level nodes only; subgraph inner nodes are keyed by
  execution id and are out of scope.

`UnconnectedInput` carries `label`, `isWidgetInput`, `nodeTitle`, `nodeMode`,
`nodeColor` and frozen `nodeProperties` because matching on `type` alone would
feed _every_ unconnected input of that type — the packs gate on a per-node
opt-in kept in properties, and omitting it produces a silent wrong broadcast
rather than a visible failure.

**`comfy.ui.addSidebarTab` — narrows §7's "no app chrome".** Sidebar tabs are
not decoration for Crystools' monitor or mtb's browser; they are the entire
node. Lifted almost directly from their `defineSidebarTab`. A tab is a Vue
component _or_ a container the pack draws into: this frontend is a Vue
application and the API is built on that rather than around it. The component
arm is currently only safe for code compiled against the host's Vue — packs
bundle their own per ADR 0005, and handing a component across two runtimes
breaks lifecycle hooks and reactivity. **Open question: export the host's Vue**,
which would make the component arm real for packs and answers Q1.

**`widget.setHeight(px)`** — named by two agents independently. `MountDef.height`
only sets CSS _inside_ an allocation the renderer already chose, so fixed strips
still drifted; presence of `computeSize` is what makes the node treat a widget
as fixed.

## 5. Why the hooks are rewritten too

**This is the part most likely to be argued with, so the reasoning is explicit.**

Today's hooks are the primary leak vector, and no amount of care in §4 closes the
surface while they stand:

```ts
beforeRegisterNodeDef(nodeType, nodeData, app) // hands out the constructor
nodeCreated(node, app) // hands out the LGraphNode
```

`nodeType` is the real class. Packs patch its prototype, wrap its methods, and
capture `app` — which reaches the entire frontend. Any pack doing this is coupled to
internals by construction, and every ECS refactor breaks it. That is the actual root
cause of this whole programme, not the individual property renames.

`defineNode(builder)` replaces prototype patching with declared intent:
`onCreated`, `onConnectionsChanged`, `onSerialize`. It covers what packs actually do
with the constructor, without handing it over.

**Honest cost:** this is the largest migration in the API, and it is the least
mechanical — prototype patches don't map to declarations by regex. Expect this
cohort to need the agent tier, and expect some packs to be genuinely unconvertible
without author involvement. That's an argument for prioritising Sink A (upstream
PRs) on exactly these packs.

`app` is deliberately absent everywhere. If something is only reachable via `app`,
either it belongs on this surface or it isn't public.

---

## 6. Proxy implementation contract

The anti-leak rules, stated as testable requirements:

```ts
const ALLOWED = new Set(['id', 'type', 'title' /* … per handle */])

new Proxy(Object.create(null), {
  get(_, key) {
    if (typeof key === 'symbol') return SYMBOL_ALLOWLIST[key]
    if (!ALLOWED.has(key)) return undefined // no constructor, no __v_raw, no prototype
    return read(id, key)
  },
  set(_, key, value) {
    if (!WRITABLE.has(key)) throw new ComfyReadonlyError(key)
    dispatch(commandFor(id, key, value)) // never a direct mutation
    return true
  },
  ownKeys: () => [...ALLOWED],
  getOwnPropertyDescriptor: (_, k) =>
    ALLOWED.has(k) ? { configurable: true, enumerable: true } : undefined,
  has: (_, k) => ALLOWED.has(k),
  getPrototypeOf: () => null,
  setPrototypeOf: () => false,
  defineProperty: () => false,
  deleteProperty: () => false
})
```

Test requirements — these are the ones worth writing first, because they're what
"closed" actually means:

- `JSON.stringify(handle)` yields only surface fields, and never throws
- `{...handle}` yields a usable plain object (the `slot_spread` fix, 23 packs)
- No property path from any handle reaches an `LGraphNode`, `LLink`, store, or Vue
  reactive — assert by walking the object graph to a fixed depth
- `structuredClone(handle.snapshot())` succeeds — proves inertness
- Every getter on a removed entity returns `undefined`; every setter throws
- `Object.getPrototypeOf(handle) === null`

---

## 7. Deliberately excluded

> Additions that are _included_ but arguable are collected in
> [§4f Contested additions](#4f-️-contested-additions--argue-with-these), with
> the alternative that was rejected and the cost of reversing each one.

| Not exposed                                              | Why                                         | If you need it                                                   |
| -------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `app` / `ComfyApp`                                       | Reaches everything                          | Named capability on `comfy`                                      |
| The node constructor                                     | Prototype patching is the coupling          | `defineNode()`                                                   |
| `LGraphCanvas`                                           | Rendering internals, changes constantly     | `comfy.ui` for the sanctioned subset                             |
| Pinia stores                                             | Internal state layout                       | Handles                                                          |
| `LLink`                                                  | Live mutable link object                    | `LinkInfo` snapshots                                             |
| `graph._nodes`                                           | Internal array                              | `graph.nodes()`                                                  |
| `node.type` setter                                       | Type is identity                            | `graph.replaceNode()`                                            |
| `widget.type` setter                                     | The hack's intent was hiding                | `widget.hidden`                                                  |
| `onDrawForeground` / `onDrawBackground` / `onDrawTitle*` | Canvas-only; already no-op under Nodes 2.0  | `node.decorations` (§4a), or `widgets.register()` if interactive |
| Global CSS reaching host markup                          | Selector-coupled to chrome we change freely | Q9 — a sanctioned theming surface                                |
| Slot `shape` on `SlotPatch`                              | Cosmetic; one site in the whole corpus      | Nothing — the saved `shape` byte is dropped                      |

No capability loss remains here — §4a covers it, and covers it in a form that renders
in _both_ modes, which the raw callbacks never did.

---

## 8. Open questions

> See also [§4f](#4f-️-contested-additions--argue-with-these) for decisions
> already taken that a reviewer may want to reverse, and
> `API_DECISIONS_FOR_REVIEW.md` for the ones blocking packs today.

- **Q1.** `mount(el, ctx)` for custom widgets is framework-agnostic and dodges the
  dual-Vue problem — but it gives up Vue's reactivity and scoped styling for the
  pack. Is that acceptable, or do we want a custom-element convention instead?
- **Q2.** Does `defineNode` genuinely cover what prototype patching is used for?
  This should be validated against the top 20 packs' actual patches _before_ the
  interface is frozen — it's the single most likely place to discover a missing
  capability after committing.
- **Q3.** Is `type` truly immutable? cg-use-everywhere and rgthree both write it,
  though rgthree's is a no-op. Confirm no pack has a legitimate need before closing
  it off.
- **Q4.** Do we ship a compatibility layer implementing the _old_ surface on top of
  the new one? It would smooth migration — but it perpetuates exactly what we're
  trying to delete, and `docs/magic_patch_WIP.md` §1 argues against shims. My read: no.
- **Q5 — resolved.** Node body decoration is specified in §4a as a declarative,
  mode-agnostic surface. Remaining sub-question: is the `Decoration` vocabulary
  sufficient? It was derived from measured canvas primitives across 420 packs, but
  should be validated by hand-porting the top 10 painters before freezing.
- **Q8.** Should `SlotId` persist in the wire format? Today it's runtime-only, so a
  slot reference doesn't survive save/reload and links still serialize positionally.
  Persisting it would make link restoration robust against slot reordering between
  versions of a pack — a real class of "my workflow rewired itself after updating"
  bug — but costs a schema bump, backend coordination, and the byte-identical
  invariant in `docs/magic_patch_WIP.md` §5. Worth costing separately; not a blocker for v1.
- **Q7.** Decorations are keyed and mode-agnostic, which means we control their
  visual language. Do they follow Comfy design standards strictly (consistent badges
  everywhere, packs lose fine-grained colour control), or do we accept arbitrary
  colours and lose visual coherence? Leaning strict, with a small named palette.
- **Q9.** Packs inject a global `<link>` and restyle whatever a selector reaches.
  Two different things hide in that. A pack styling **its own** mounted widget DOM
  is legitimate — it owns those elements, and plain `new URL(…, import.meta.url)`
  keeps resolving correctly no matter what the install directory is called. A pack
  restyling **our** node chrome is a parallel front end: coupled to markup we
  change freely, and the same objection that excluded canvas painting. We should
  not support the second by selector, but Nodes 2.0 **should** have a sanctioned
  way to be re-themed — most plausibly a named CSS-variable contract, which is
  reviewable, versionable, and survives markup changes. Worth settling early:
  once packs re-establish selector coupling against Nodes 2.0 markup, it is as
  unshakeable as the coupling this whole migration exists to remove.
- **Q6.** Where does this live — `packages/comfyui-node-api/` as a published types
  package, so pack authors can `npm i` the types and get autocomplete? That seems
  clearly right and cheap.

---

## 9. What this unblocks

Every census surface gets a destination, which means:

- **The vue-only cohort** (653 packs / 35.0% of installs) is blocked _only_ on
  `widgets.reorder()`, `widget.hidden`, and `comfy.widgets.register()`. Three
  additions retire it.
- **The painting cohort** (420 packs / 32.2% of installs) is blocked only on §4a.
- The old surfaces become deletable, which was the entire point.
- Pack authors get a contract they can target across frontend versions — the
  precondition for the upstream-PR programme being worth an author's time.

The reverse, stated plainly: **without this, `docs/magic_patch_WIP.md` can only ever address
16% of installs**, because there is nowhere to migrate the rest to.

### The de-duplicated numbers

Computed over `registry_scan.json` (4,983 packs, 106,413,232 downloads). **Do not
add the cohorts — they overlap heavily:**

| Cohort                    | Packs   | Downloads      | % installs |
| ------------------------- | ------- | -------------- | ---------- |
| Unconditional             | 124     | 17,130,463     | 16.1%      |
| Vue-only                  | 657     | 37,239,896     | 35.0%      |
| Painting                  | 420     | 34,299,457     | 32.2%      |
| **Union (de-duplicated)** | **851** | **42,594,125** | **40.0%**  |
| _(naive sum — wrong)_     |         |                | _83.3%_    |

**52 packs are in all three cohorts**, including rgthree, easy-use, VideoHelperSuite,
comfy-mtb, inspire-pack and mixlab.

Two consequences, pulling in opposite directions:

- **Per-pack migration is harder than any single cohort suggests.** The biggest packs
  need connectivity _and_ widget _and_ painting migration, plus the hook rewrite
  (§5). For these, a mechanical patch is unlikely to be the whole answer.
- **But the distribution is extremely concentrated: the top 20 affected packs carry
  77.9% of all affected downloads.**

That second number is the most actionable fact in this analysis. It says the
upstream-PR programme (`docs/magic_patch_WIP.md` Sink A) should not be a broad 851-pack
campaign — **it should be ~20 hand-managed maintainer relationships**, with the
automated manifest covering the long tail. Twenty conversations get ~78% of the
user-visible benefit, and those are exactly the packs where an automated patch is
least likely to be correct unattended.
