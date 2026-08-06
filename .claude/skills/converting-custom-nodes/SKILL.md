---
name: converting-custom-nodes
description: 'Converts third-party custom-node JS off deprecated/unpublished ComfyUI APIs onto the published node API. Use for Magic Patch conversion work, migrating a pack, or reviewing a generated patch. Triggers on: convert custom node, magic patch, migrate pack, port to node API, output.links, input.link, widgets.splice, converted-widget.'
---

# Converting Custom Nodes

Converts third-party pack JS from the old, unpublished ComfyUI internals onto
the published node API (`src/platform/nodeApi/`, specified in `docs/node_api_WIP.md`).

This is **migration, not compatibility work**. The goal is that the old surface
can be _deleted_, so never add a shim — rewrite the call site.

## When to Use

- Converting a pack that Magic Patch escalated (`convert()` reported it in
  `escalated`, meaning the mechanical rules deliberately refused).
- Hand-writing a conversion for an upstream PR.
- Reviewing a generated patch before it ships.

Do **not** use it to make broken code work again by any means available. A
conversion that reintroduces the old coupling is worse than no conversion.

## The two invariants

Everything below serves these. If a conversion violates either, it is wrong even
if the pack appears to work.

**1. The wire format must be byte-identical.**
`graphToPrompt` output and the serialized workflow must not change. This is the
frontend's contract with the backend, and it holds for 1,801/1,801 packs today —
which makes it an extremely sharp detector. The most common way to break it is
disconnect-and-reconnect, which allocates **new link ids**. Use
`output.moveLinksTo()` when re-homing links.

**2. Behaviour must be equivalent, except where the old code threw.**
The generated test has two halves: `equivalence` (must pass on the original
_and_ the converted source) and `fix` (must fail before, pass after). If you
cannot state an equivalence claim, you do not yet understand the code well
enough to convert it.

## Steps

### 1. Read what the code is actually doing

Do not pattern-match on the API name. The census surfaces are misleading:

- A `widgets.splice(i, 1)` immediately followed by `splice(i, 0, w)` is **not a
  reorder** — it is a cache-invalidation hack. Replace it with
  `widget.setOption(key, value)`, which invalidates properly.
- `onDrawForeground` is often **not drawing**. 47% of draw-callback bodies never
  touch a drawing primitive; they enforce size, poll for changes, or sync DOM
  visibility. Those become `setSizeConstraints`, `widget.on('change')`, and the
  widget mount lifecycle respectively.

### 2. Check whether the object is live or serialized

**The single most dangerous confusion in this work.** These look identical:

```js
node.inputs[0].link = null // live slot — convert
p.workflow.nodes[i].inputs[0].link = null // serialized JSON — LEAVE ALONE
```

The second is correct as written; rewriting it corrupts a working pack. Trace
the variable to its origin before touching anything named `link`, `links`,
`inputs`, `outputs` or `widgets`. If it came from `graphToPrompt`, a fetch, a
`JSON.parse`, or a `.workflow` property, it is data — not a graph.

### 3. Apply the mapping

| Old                                      | New                                       | Notes                                                                     |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `output.links.push(id)`                  | `output.connectTo(nodeId, inputRef)`      | creating a connection                                                     |
| moving links between own outputs         | `output.moveLinksTo(ref)`                 | **preserves link ids** — required for the wire gate                       |
| `output.links` (read)                    | `output.links()`                          | frozen snapshot, safe to iterate while disconnecting                      |
| `input.link = null`                      | `input.disconnect()`                      | check step 2 first                                                        |
| `input.link` (read)                      | `input.source()` / `input.isConnected`    |                                                                           |
| `node.type = x`                          | delete the line                           | usually a defensive no-op; true type replacement is a **gap** — punt it   |
| `slot.type = x`, `slot.name = x`         | `slot.modify({ type, name })`             | atomic, one undo step; keeps existing links                               |
| `widget.type = 'converted-widget'`       | `widget.setHidden(true)`                  | ⚠️ old hack also suppressed serialization — see `references/widgets.md`   |
| `widgets.splice` to reorder              | `widgets.reorder(names)`                  | throws on a partial list instead of dropping widgets                      |
| `widgets.splice(i,1)` + `splice(i,0,w)`  | `widget.setOption(key, value)`            | same index in/out = cache invalidation, **not** a reorder                 |
| `widgets.push(w)`                        | `widgets.add(def)`                        |                                                                           |
| `widgets = [...]` / `widgets.length = n` | `widgets.remove(name)`                    | assignment drops renderer tracking; length skips teardown                 |
| `getCustomWidgets` POJO                  | `widgets.mount({ mount })`                |                                                                           |
| `{...input}` / `{...node}`               | `.snapshot()`                             | accessors moved to the prototype, so spread yields nothing                |
| `nodeType.prototype.onNodeCreated = ...` | `defs.extend(sel, b => b.onCreated(...))` | selector = the hook's existing guard clause                               |
| `nodeType.prototype.onExecuted = ...`    | `b.onExecuted(node, result)`              | see `references/node-definitions.md`                                      |
| `nodeType.prototype.onConfigure = ...`   | `b.onConfigured(node, data)`              |                                                                           |
| `nodeType.prototype.onRemoved = ...`     | `b.onRemoved(node)`                       |                                                                           |
| `widget.inputEl`                         | `widgets.mount({ render })`               | the element arrives as `render`'s argument; there is no `inputEl` to read |
| `this.widgets.length = n`                | remove by name                            | assigning length skips widget teardown                                    |
| `+!!this.inputs[0].widget`               | `input.isWidgetInput`                     | converted-widget sniffing                                                 |
| `onDrawForeground` (drawing)             | `widgets.canvas({ draw })`                | renders in canvas _and_ Nodes 2.0                                         |
| `onDrawForeground` (sizing)              | `node.setSizeConstraints({ autoHeight })` | see `references/draw-callbacks.md`                                        |
| `onDrawForeground` (polling)             | `widget.on('change')`                     | pick the narrowest event                                                  |
| `extends LGraphNode`                     | `defs.define({ type, ... })`              | virtual nodes use `resolve(ctx)`                                          |
| `onConnectInput` returning `false`       | `b.onBeforeConnect((node, e) => false)`   | any listener refusing is enough                                           |
| `getExtraMenuOptions` (node menu)        | `b.addMenuItem({ label, run })`           | entries accumulate; canvas/slot menus are still a **gap**                 |

Prefer `comfy.supports('...')` over version comparisons — see `docs/node_api_WIP.md` §2.

### 4. Watch for the frame-to-event shift

A draw callback recomputed from current state every repaint, so nothing ever
needed to announce a change. Declarations and decorations must be **set when the
value changes**. A port that calls `decorations.set()` from inside the old
callback body will appear to work and quietly run on every repaint forever.

### 5. Write the test before claiming success

State an equivalence claim and a fix claim. Run the file against both sources:
equivalence green on both, fix red on the original and green on the converted.
A fix-only test proves the conversion did _something_, not that it was safe.

### 6. Refuse when you should

Escalate or decline rather than guess when:

- You cannot tell whether the object is live or serialized (step 2).
- The replacement depends on intent you cannot recover — e.g. re-homing links
  versus rebuilding a mirror have different correct answers.
- The published API has no destination. A missing API is a **core gap to file**,
  not something to work around in a pack. `docs/node_api_WIP.md` §1 lists what is and is
  not covered.

A refusal costs a round trip. A wrong rewrite of working code is invisible until
a user hits it.

**A partial conversion is worse than a punt.** Two checks enforce this and both
fail the whole file:

- `retires-the-old-surface` — no `X.prototype.foo = ...` may remain. Converting
  a function body while leaving the prototype assignment that reaches it moves
  nothing; the old surface still cannot be deleted, which is the only reason
  this programme exists.
- `no-unknown-api-members` — every member you introduce must exist in the
  published API. Do not invent a plausible-sounding method. If the capability
  you need is absent, that is `api-gap`, and naming it precisely is the most
  useful thing you can do.

Both of these caught real conversions that every other check passed.

## Keep the diff small — it is the message

These diffs are read by the pack's author, often as a pull request. A patch that
touches ten lines says _we moved you off two deprecated calls_. A patch that
rewrites the file says _we rewrote your code_, and it will be rejected on sight
even when it is correct. Restructuring you did not need is not neutral.

**Change the registration. Leave everything else where it is.**

```js
// before
app.registerExtension({
  name: 'x.ShowText',
  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name === 'ShowText') {
      function populate(text) {
        /* 30 lines */
      }
      nodeType.prototype.onExecuted = function (message) {
        populate.call(this, message.text)
      }
    }
  }
})
```

Two conversions of that, both correct:

```js
// ✗ restructured — populate hoisted, dedented, renamed, signature changed.
//   Every line of a 30-line helper shows as changed.
function populateText(node, lines) {
  /* 30 lines, reflowed */
}
comfy.defs.extend('ShowText', (b) => b.onExecuted(populateText))

// ✓ minimal — the helper stays exactly where and as it was.
comfy.defs.extend('ShowText', (b) => {
  function populate(text) {
    /* 30 lines, byte-identical */
  }
  b.onExecuted((node, result) => populate.call(node, result.text))
})
```

Both work. The second is the one an author merges.

Rules that follow from this:

- **Do not hoist, reorder or rename anything** the conversion does not require.
  Keep helper names, parameter names and their order.
- **Keep helpers nested where they were nested.** Pulling one to module scope
  changes every line of it.
- **Do not normalise style.** Quotes, semicolons, spacing and line breaks are
  the author's, not yours.
- **Do not "improve" adjacent code.** A bug next to your change is not your
  change.

### Indentation: match the original where you can, fix it where you must

The patch gets applied to the author's working tree, so a diff that minimises
its own size by leaving the body at its old depth ships them badly indented
code. That is a worse outcome than a larger diff.

The rule, in order:

1. **Prefer the original indentation.** If a line's nesting depth has not
   actually changed, do not touch its leading whitespace.
2. **Re-indent when the nesting genuinely changed.** Removing a
   `registerExtension` wrapper takes two levels off everything inside it, and
   the result has to be correctly indented. Do it.
3. **Never re-indent anything whose nesting did not change.** That is the
   churn worth eliminating, and it is entirely elective.

So the thing to avoid is not re-indentation, it is _gratuitous restructuring_ —
hoisting a helper to module scope, renaming its parameters, reflowing a function
the conversion never touched. Those change every line of code that did not need
to change. Correct indentation is not negotiable; unnecessary movement is.

Across the current database the unavoidable dedent accounts for 17–39% of added
lines. `run_checks` reports the proportion so you can see whether yours is in
that range or well past it.

## Recognise the intent, not the call

Most old-API code is a workaround for something missing. Port the call and you
carry the workaround across; recognise what it was _for_ and it usually
collapses. Check these before converting anything mechanically.

**If you are converting `api.addEventListener('b_preview')` or
`'b_preview_with_metadata'` or `'executing'`** — check whether the pack is
correlating frames to one node (a module-level `execId`, a
`displayNodeId === this.id` test, a `serverSupportsFeature` probe). That whole
apparatus answers "is this frame mine?". **Use `b.onPreview((node, frame) =>
…)`**, which answers it for you. Delete the global; it also mis-attributes
frames when two nodes preview at once.

**If you are converting `onDrawForeground` / `onDrawBackground` / anything
using `ctx`** — check what it actually draws. Rectangles, images, text and
lines are all a canvas can give you and all a DOM can. **Use
`node.widgets.canvas({ name, height, draw(ctx, [w, h]) })`** and keep the
drawing code as it is. It renders under both the old graph renderer and Nodes
2.0. Do not reach for the graph's shared context — that is the thing that ties
a pack to the old renderer.

**If you are converting hand-rolled hit testing** — bounding-box maths against
`node.pos`/`node.size`, pointer capture on `document`, hit tests against link
curves. Check whether it exists only because canvas has nothing to attach a
listener to. **Mount the control with `node.widgets.mount(...)` and use
ordinary DOM events**; most of the geometry disappears rather than being
ported.

**If you are converting `node.addDOMWidget(...)`** — **use
`node.widgets.mount({ name, render(container), destroy() })`**. Put the teardown
in `destroy`: a mounted element owns listeners, timers and observers that node
removal would otherwise leave running.

**If you are converting `node.addInput` / `removeInput` / `addOutput`** — the
pack is almost certainly growing slots as the last one fills (the "Multi"
combiner shape). **Use `node.inputs.add(name, type)` / `node.inputs.remove(ref)`**
and the matching `node.outputs` calls, driven from `b.onConnectionsChanged`.

**If you are converting `canvas.selected_nodes` / `selectedItems`** — the pack
wants the user's current selection, and is reaching into the canvas for it.
**Use `comfy.graph.selection()`**, which returns node handles.

**If you are writing to a node or widget handle** — every read and write is a
**method**, never a property: `setTitle`, `setColor`, `setBgColor`, `setMode`,
`setCollapsed`, `setProperty`, `getSize`/`setSize([w, h])` on nodes;
`getValue`/`setValue`, `isHidden`/`setHidden`, `setOption` on widgets. Property
syntax compiles and silently does nothing. See the table in
`references/node-definitions.md`.

**If you are converting `registerCustomNodes` / `extends LGraphNode` /
`isVirtualNode` / `applyToGraph`** — identify which of four intents the node
serves (annotation, wire, value, or acting on other nodes) and use **`comfy.defs.define`**
with `execution: 'frontend'` and, for wires and values, a pure `resolve`. See
`references/node-definitions.md` — nodes that act on others mutate neighbours through
handles in widget callbacks, never in `resolve`.

**If you are converting `onResize` / `computeSize` / a per-frame `setSize`** —
check whether the pack is enforcing a minimum, or growing to fit something it
mounted. **Use `node.setSizeConstraints({ minWidth, minHeight, maxWidth,
maxHeight, autoHeight })`** once, rather than re-asserting size on every frame.
`autoHeight` is usually the real intent.

**If you are converting `onSerialize` / `chainCallback(node, 'onSerialize')`** —
the pack is saving its own state into the node. **Use `b.onSerialize((node) =>
({ myKey: … }))`**; it comes back through `b.onConfigured`. Core fields —
`type`, `widgets_values`, `inputs`, `pos` and the rest — are ignored if you
return them, because changing those changes what the workflow means.

**If you are converting `onConnectInput` / `onConnectOutput`** — check what the
pack does with the return value. If it returns `false` to refuse a wire, **use
`b.onBeforeConnect((node, e) => …)`** and return `false` to refuse; `e` carries
`side`, `index`, `peerNodeId` and `peerType`. Any listener refusing is enough —
one pack cannot be overruled by another's silence. If it does not return
`false`, it is only observing, so **use `b.onConnectionsChanged`** instead: a
veto that never vetoes is a listener wearing the wrong hat.

**If you are converting `getExtraMenuOptions` or a `ContextMenu` the pack builds
itself** — check whether it is a menu _on a node_. If so, **use
`b.addMenuItem({ label, run(node) })`**; entries from every pack accumulate
rather than overwrite. A `ContextMenu` constructed to build a canvas-wide or
slot menu is not this, and is still a gap — punt it and name it.

**If you are converting a pack that writes its own name-keyed shape into
`widgets_values`** (a dict keyed by widget name, rather than the positional
array) — the pack is reaching for something the new model already gives it.
**Widget values are keyed by name at runtime**: `widgetValueStore` is keyed by
`graphId:nodeId:name` (`src/types/widgetId.ts`), with no index in the identity.
The positional array is only the legacy _serialized_ form, which is why
`widgets_values` is reserved.

So **delete the override, do not translate it.** Address widgets by name — that
is native — and let core serialize the positional array as it already does. The
pack's serialize hook largely disappears rather than being ported.

What you must keep is the _reading_ of old workflows. Core assigns positionally
and _then_ calls `onConfigure`, so `b.onConfigured` receives the saved node with
its legacy shape intact. Port the pack's rename maps, retired-widget handling
and positional-to-named fallbacks into that hook: those are the conversion, and
dropping them silently loses user data.

**If you are converting reads of `canvas.connecting_links`, `resizing_node` or
`node_widget`** — the pack is asking one question, not three: _is the editor
already mid-gesture?_ **Use `comfy.isInteracting()`** and stand down while it is
true. Do not reach for the individual fields; which gestures exist is the
editor's business and will change.

**If you are converting a pack that listens on `document` for pointer moves to
build an editing gesture** (drag one node onto another, shake to disconnect,
drop onto a link) — **use `comfy.onNodeMoved`**, which reports node movement
under both renderers from one subscription. Two cautions: it does not say
whether a _person_ moved the node, so guard your own writes against re-entry;
and there is no drag start/end, so a gesture that must commit on release cannot
be built on this alone — punt that and name it.

**If you are converting `canvas.setDirty(...)` / `setDirtyCanvas(...)`** —
**delete it.** There is no published repaint request, deliberately. Handle
writes invalidate on their own, and a `widgets.canvas` surface has `redraw()`.
If something genuinely fails to repaint after a handle write, that is a bug in
the API — report it rather than working around it.

**If you are converting `addWidget('button', name, null, callback)` or any
widget whose callback is an action rather than a value change** — **use
`widget.on('activate', fn)`**. A button's value never moves, so `on('change')`
can never fire for one. Keep the widget itself (`widgets.add({ type: 'button',
name, value: null })`) — its `widgets_values` entry is positional, and dropping
it shifts every widget after it.

**If you are converting `app.ui.settings.getSettingValue` / `addSetting`, or a
`settings: [...]` array in `registerExtension`** — **use `comfy.settings`**:
`declare({ id, name, type, defaultValue })` once at load, then `get(id)` and
`await set(id, value)`. Ids must be namespaced (`MyPack.thing`) — one flat space
is shared with core and every other pack, and the id is where the value lives
permanently. Re-declaring does not reset a stored value, so declaring on every
load is correct.

**If you are converting a read of `LiteGraph.NODE_SLOT_HEIGHT`,
`NODE_TITLE_HEIGHT`, `ROUND_RADIUS` or `vueNodesMode`** — **use
`comfy.constants`** (`slotHeight`, `titleHeight`, `cornerRadius`,
`domRenderer`). It returns a frozen snapshot by value; do not hold the object.
Reach for `domRenderer` only when you genuinely must pick a strategy —
`widgets.mount` and `widgets.canvas` already work under both renderers, so
needing it usually means the conversion took a wrong turn.

**If you are converting `this._somethingPrivate = x` on a node** — handles hold
no arbitrary properties. **Keep a `Map` keyed by `node.id`** and clear the entry
in `b.onRemoved`. This is supported, not a workaround; the old property was
collected with the node and a Map is not.

**If you are converting `node.imgs = [img]` + `setDirtyCanvas`** — the pack is
showing an image on the node. **Use `widgets.canvas` and `drawImage` in
`draw`**, then `redraw()` when the image changes.

**If you are converting a captured-and-chained `widget.callback`** — check
whether it only wants to know the value changed. **Use `widget.on('change', (v,
old) => …)`**, which is additive: no other pack can drop your listener by
forgetting to call through.

**If you are converting `widget.serializeValue = async () => {}`** — the pack is
keeping a derived value out of what gets saved. **Use `serialize: false`** on
the widget definition. Note the two are distinct: `options.serialize` gates the
API prompt, `widget.serialize` gates workflow persistence.

**If you are converting `widget.type = 'converted-widget'`** — the pack is
hiding a widget, not changing its kind. **Use `widget.setHidden(true)`.** The
`origType`/`origComputeSize`/`origSerializeValue` bookkeeping around it existed
only to undo the hack; it has no readers and goes away.

## Pattern references

Deep dives, loaded only when relevant. `SKILL.md` stays short on purpose; detail
lives here.

| Reference                        | Covers                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/nodegraph-101.md`    | **Read first if you have not converted a pack before.** What a node graph is, the definition/class/instance distinction, the lifecycle, workflow vs prompt, and why packs patch prototypes at all. |
| `references/node-definitions.md` | `beforeRegisterNodeDef` + prototype patching — **1,265 packs, 47.4% of installs, the largest surface**. The selector is already written as the hook's guard clause.                                |
| `references/widgets.md`          | Widget-array mutation and the converted-widget protocol — 286 packs / 21.6%, overlapping cohorts totalling more. Where naive conversions are most often silently wrong.                            |
| `references/draw-callbacks.md`   | `onDraw*` — 420 packs, 32.2% of installs. Measured breakdown showing 47% never draw at all, a decision tree, and the canvas→CSS mapping.                                                           |

### Adding a pattern

Add a reference when a pattern is (a) seen in real pack code, not anticipated,
and (b) large or subtle enough that the mapping table row is insufficient.

Each reference should carry:

1. **How common it is**, measured — not estimated. Counts come from the corpus
   at `~/comfy/nodes-compat-study/`, and should be labelled grep-derived where
   they are.
2. **What the code is actually doing**, which is often not what the API name
   suggests. Classify before mapping.
3. **Real before/after**, quoted from a named pack and file.
4. **The trap** — the way a plausible conversion silently goes wrong.

If a pattern turns out to be mechanically safe, add it to
`conversion/rules.ts` instead: a rule with golden cases beats prose, because CI
runs it. Prose is for the judgement calls.

## Where things live

|                                     |                                                           |
| ----------------------------------- | --------------------------------------------------------- |
| Published API spec                  | `docs/node_api_WIP.md`                                    |
| Published API code                  | `src/platform/nodeApi/`                                   |
| Rule catalog (per-pattern guidance) | `src/workbench/extensions/magicPatch/conversion/rules.ts` |
| Verdict grading                     | `src/workbench/extensions/magicPatch/verify/verdict.ts`   |
| Programme design                    | `docs/magic_patch_WIP.md`                                 |

The rule catalog's `guidance` field is injected into the agent prompt for
**only the rules that matched**, so this skill covers method and the catalog
covers specifics. Keep it that way — duplicating pattern detail here means it
will drift.

## Checklist

- [ ] Traced every `link`/`links`/`widgets` reference to live-vs-serialized
- [ ] No shim, no compatibility wrapper, no reintroduced old API
- [ ] Link ids preserved where links were moved
- [ ] Equivalence claim stated and passing on both sources
- [ ] Fix claim red on the original, green on the converted source
- [ ] `graphToPrompt` and serialized workflow byte-identical
- [ ] Anything uncertain escalated rather than guessed
