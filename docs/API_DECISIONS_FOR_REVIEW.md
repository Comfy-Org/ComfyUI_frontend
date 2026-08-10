> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> Companion to `magic_patch_WIP.md`, `node_api_WIP.md` and
> `magic_patch_test_plan_WIP.md`.
> Notion copy for review: **API Decisions for Review** in the Documents Hub.

# API decisions for review — node API / Magic Patch

**The design is settled. Everything here is an implementation issue.** Each
entry surfaced from converting real packs onto the published node API
(`src/platform/nodeApi/`) and loading them in a real ComfyUI — defects, format
mismatches, and places where the implementation does not yet reach what the
design already calls for.

**Who signs off what.**

| Area                                                               | Owner                              |
| ------------------------------------------------------------------ | ---------------------------------- |
| API surface shape, widgets, node definitions, Nodes 2.0 theming    | **Christian**                      |
| Graph model, resolution/supply, ECS-side invariants, slot identity | **Alex**                           |
| Scope, sequencing, what we decline to support                      | **Ben** (owner), escalate to Miles |

The choices recorded below were taken to unblock a proof of concept and get it
to a go/no-go, not to settle policy. Where one was made to keep moving, it is
marked _provisional_ and the reasoning is written out so it can be overturned
cheaply. Several have blast radius well beyond this programme, and are flagged
as such.

**This file is one half of the review.** The other half lives in
`node_api_WIP.md`:

- **§4f Contested additions** — surface we _added_ that is arguable, each with
  the alternative rejected and the cost of reversing it.
- **§7 Deliberately excluded** — asks we are refusing.
- **§8 Open questions** — Q1–Q9, including the Nodes 2.0 re-theming question.

The split: _"we added this to the API, argue with it"_ → `node_api_WIP.md` §4f.
_"this is broken or undecided, someone must rule"_ → here.

**Status key:** ✅ fixed · 🟡 provisional, not yet built · ❓ needs a call before
it can be built.

Each entry states: what was found, the evidence, what was done for now, and what
is still open.

---

## 1. `widgets_values` round trip — serialize and configure disagreed ✅

**The defect.** `LGraphNode.serialize()` writes each value at the widget's _own_
index, so a widget with `serialize === false` leaves a hole. `configure()` read
the array _compacted_, skipping non-serialising widgets and consuming values in
order. The two disagree whenever a non-serialising widget precedes a persisted
one.

Minimal reproduction — widgets `[panel (serialize:false), seed]`, `seed = 1234`:

```
saved:    widgets_values = [null, 1234]
reloaded: seed === null
```

Silent user data loss. No error, no warning.

**Why it went unnoticed.** PR #921, which introduced the compacted read, says so
itself: _"Current usage in frontend should not be affected as preview media
widgets are mostly dynamically added at the end of widget list."_ Where the
non-serialising widget is last, the two layouts coincide. The programme's own
`widgets.mount()` is what breaks that assumption, since it sets
`serialize: false` on a widget a pack may mount anywhere.

**History.** `serialize()` has written by index since the file was first
authored — `o.widgets_values[i] = …`, never `push`. The compacted read arrived
later (#921) and was carried forward through #6661 and #7205. So the write is
the long-standing format and the read is the deviation.

**Provisional — implemented.** `configure()` now reads the indexed layout, and falls back to the
compacted one. The two are distinguishable: a saved array is longer than the
count of serialising widgets _exactly when_ a hole precedes a value, and where
they are not distinguishable they agree. Hand-written and older compacted data
keeps loading — including the array asserted by #921's own test.

`serialize()` is unchanged; it was always correct.

**Verification.** `widgetsValuesRoundTrip.test.ts` covers five widget layouts;
the three with a hole before a value fail against the old read and pass against
the new one. Full litegraph suite: 1152 passing.

**Question.** Should `serialize()` stop emitting the hole
altogether — i.e. write compacted and drop indexed support after a deprecation
window? That would make the format smaller and unambiguous, at the cost of a
migration. Current change is deliberately compatible in both directions and
takes no position on that.

---

## 2. What "byte-identical wire format" means for mounted widgets ✅

The verification gate rests on the invariant that a conversion must not change
the saved workflow or the queued prompt. **The code and the invariant currently
disagree**, and the disagreement is in the API layer, not the packs.

`widgets.mount()` sets _both_ serialization flags. The legacy
`addDOMWidget(…, { serialize: false })` set only `options.serialize` and left
`widget.serialize` undefined. So a converted node saves **one fewer**
`widgets_values` entry than the original.

Hit independently in three packs:

- **kjnodes** `context_windows_visualizer` — 11 entries became 10.
- **Impact Pack** `MaskRectArea` — one trailing `null` dropped.
- **LayerStyle** — the agent _declined to mount_ a colour picker for this
  reason: mounting would have silently stopped persisting users' colours. It
  used core's `COLOR` widget instead, and the wire format was preserved.

The two flags are genuinely distinct and documented
(`src/lib/litegraph/docs/WIDGET_SERIALIZATION.md`): `widget.serialize` gates
workflow persistence, `widget.options.serialize` gates the API prompt.
`MountDef` collapses them into one boolean, so the "persist but do not send"
and "send but do not persist" quadrants are inexpressible.

**Provisional — now implemented.** `MountDef` gained `sendToPrompt`, which
defaults to `serialize` and overrides only the prompt half. The two states that
one boolean could not say are now sayable, and "saved but not sent" — exactly
what legacy `addDOMWidget(…, { serialize: false })` did — is the one packs
actually need.

The case that forced it: bjornulf's `show_text` creates one readout widget per
line of its result, and the original named **every one of them `text`**. Widget
identity is now the name, so the conversion had to rename them `text`, `text_1`,
`text_2` — and since `graphToPrompt` writes `inputs[widget.name]`, each rename
became a **new key in the queued prompt** that the original never sent. The
renamed duplicates are now `sendToPrompt: false`, so the prompt keeps exactly
one `text` key.

One residual delta, stated rather than buried: same-named widgets overwrite in
order, so the original sent the _last_ line under `text` and the conversion
sends the _first_. Matching that exactly is not expressible while the prompt key
is the widget name. For a readout the node fills in from its own execution
result the echoed value is inert, so this was judged acceptable — but it is a
real difference, and it is the same duplicate-name root cause that blocked
pysssss' `betterCombos` and easy-use's `showAnything`.

**Question.** Should a _newly mounted_ widget (one with no
legacy counterpart — e.g. a pack adding a canvas preview to a node that had no
widgets) default to persisting? Defaulting to "yes" matches legacy exactly but
means a pack that merely _draws_ something adds an entry to the user's saved
workflow. Defaulting to "no" is cleaner but is not byte-identical for
conversions.

---

## 3. Custom widgets are silently discarded when they shadow a core name ❓

`src/stores/widgetStore.ts:14`:

```ts
;() => new Map([...customWidgets.value, ...Object.entries(coreWidgets)])
```

Core widgets are spread **last**, so on a name collision core silently wins. A
pack registering a widget named `COLOR`, `STRING`, `INT`, `COMBO`, … via
`getCustomWidgets` has no effect and gets no error.

**Measured blast radius** (corpus of 4,998 registry packs): 91 packs use
`getCustomWidgets`; **12 register a name that collides with a core widget**,
totalling **6.8M downloads (6.4% of all)**:

| downloads | pack                     | colliding names    |
| --------- | ------------------------ | ------------------ |
| 3,301,869 | comfyui-easy-use (#3)    | COMBO, INT, STRING |
| 1,986,588 | comfyui_layerstyle (#12) | COLOR              |
| 908,221   | comfy-mtb (#25)          | COLOR              |
| 573,364   | comfyui-mixlab-nodes     | INT, STRING        |
| … 8 more  |                          |                    |

This was found because LayerStyle's DZ colour widget turned out to be
**already unreachable** — so its removal during conversion was not a regression.

**Needs a call, because both directions are defensible.** Either:

- **Core wins is intended** — then `getCustomWidgets` is misleading and should
  fail loudly (or warn) when a pack shadows a core type, rather than silently
  discarding the registration; or
- **Packs should win** — then swapping the spread order hands `STRING` / `INT` /
  `COMBO` rendering to third-party packs across the ecosystem in one release.
  Large blast radius for a one-line change.

Not touched pending a decision.

---

## 4. Resolution does not yet implement the supply direction ❓

`resolveFrontendNodes` answers _"what feeds my output"_. It iterates only nodes
that registered a resolver, and only over **their own outputs**
(`src/platform/nodeApi/resolution.ts:180-186`):

```ts
for (const node of graph.nodes ?? []) {
  if (!resolvers.has(node.type ?? '')) continue
  const outputs = node.outputs?.length ?? 0
  for (let output = 0; output < outputs; output++)
    follow(String(node.id), output, new Set())
}
```

**cg-use-everywhere** (#13, 1.89M downloads) broadcasts a value to every
matching _unconnected input_ in the graph. Two independent blockers:

1. Its nodes have **zero outputs**, so the loop body never runs and a
   registered resolver is silently never called.
2. `ResolvedSource` is returned per `nodeId:output`. There is no channel by
   which a resolver can name _another node's input_.

Result: 2 of 20 files converted; 12 refused. The pack is not shippable on the
current API.

The read-only view is also far narrower than the matching needs. UE matches on
link type, node title regex, input name regex, group membership, node colour,
`properties.ue_properties.*` and priority. `ResolveView` offers:

```ts
interface ResolvedNodeView {
  id
  type
  widgetValue(name)
  input(ref)
}
interface ResolveView {
  self
  nodesOfType(type)
}
```

Missing: title, properties, colour, slot names/labels/types, `isConnected`, an
all-nodes enumeration — and **there is no group API anywhere in
`src/platform/nodeApi/`**.

**Provisional position:** this must be supported. The two graphs hold the same
data before and after conversion, and a node having no output does not prevent inferring the
value it carried — the information is all present. The gap is in the
implementation, not the model.

**Question — what shape?** The straightforward one is a
graph-level supply pass folded into the same fixpoint, e.g.
`supply(view) => Map<InputRef, OutputResolution>`, so injected sources chain
through Reroutes like ordinary ones. That needs a view rich enough to express
the matching **without** handing packs the live graph — the sandbox constraint
is that resolution stays pure and read-only over a projection we control.

**This is not one pack.** rgthree (#2, 3.7M downloads) is the same broadcast
shape at roughly seven times the size. Together ≈5.6% of all downloads.

---

## 4a. rgthree is blocked, but not by resolution ❓

**Correction to §4.** rgthree-comfy (#2, 3.69M downloads) was assumed to be the
same broadcast shape as cg-use-everywhere. It is not, and the assumption was
made from surface similarity rather than evidence.

- **Reroute** (`reroute.ts:397`) and **Node Collector** are ordinary demand-side
  passthroughs. Reroute is exactly `{forwardTo: {nodeId: self.id, input: 0}}`,
  and `resolution.ts:165-174` already chains reroute→reroute to a fixpoint.
- **Context, Context Big, Context Switch/Merge** and **Any Switch** are
  **backend** nodes (`extends RgthreeBaseServerNode`, registered through
  `beforeRegisterNodeDef`). Python does the switching; the frontend only does
  connection ergonomics.
- There is **no `applyToGraph` anywhere in the pack**, no fan-out, no injection
  into another node's unconnected input.

**What actually blocks it is larger.** rgthree replaced ComfyUI's node class,
extension system, widget layer and menu system with its own: it intercepts
`LiteGraph.registerNodeType` to substitute its own class
(`base_node.ts:482-504`), patches 14 core prototypes (`rgthree.ts`), and ships a
parallel widget framework (`utils_widgets.ts`). It is not a pack that calls a
few deprecated APIs.

| bucket                   | files | note                         |
| ------------------------ | ----- | ---------------------------- |
| converts cleanly today   | 7     | but cannot _run_ — see below |
| blocked on a known gap   | 21    | loses named features         |
| blocked on something new | 20    | 15 distinct new capabilities |

The bucket counts understate it: `utils.js` is imported by **28** of 48,
`rgthree.js` by 19, `base_node.js` by 17 — and all three are in the blocked set.
So the 7 clean files can be written but not run until the foundation is
rearchitected.

**Recommendation: do not convert rgthree pack-wide.** If it is worth revisiting,
three additions carry most of it, in order of leverage per cost:

1. **A node-mode-change notification** (`onModeChange`). Cheap. rgthree does it
   with `defineProperty(this, 'mode', {set})` (`base_node.ts:96-107`); it is the
   sole driver of Node Mode Repeater.
2. **A group API** (gap 18). Fast Groups Muter, Fast Groups Bypasser and the
   group-header toggles are 100% dead without it.
3. **A prompt-serialization lifecycle hook** (between serialize and POST).
   Distinct from gap 26 ("no snapshot") and 27 ("no queueing"). Unblocks Seed
   and Random Unmuter.

Two things it needs that I would **not** build for it: substituting the node
class for a backend-registered type, and intercepting an in-flight link drag.

**The wire-format item that matters most, at this install base.** `context.ts`
runs a slot-name migration on every load — including a `CLIP_HEIGTH` →
`CLIP_HEIGHT` typo fix whose comment says it must live "in perpetuity". It _is_
expressible (`b.onConfigured` + `slot.modify({name})` + `output.moveLinksTo()`),
but only carried over verbatim. Dropped, old workflows silently land links on
the wrong slot.

**Seed is the other one.** `widgets_values` keeps the sentinel `-1` and the real
seed is injected into the prompt after `graphToPrompt`. Converted without a
prompt lifecycle hook, every queued prompt sends `-1` and the backend
randomizes — reproducibility breaks, not just bytes.

## 5. `diff-is-mostly-substance` contradicts the conversion guidance ✅

The check fails a file when most added lines differ only in indentation, on the
theory that the file was reflowed rather than converted. But unwrapping
`app.registerExtension` around a 500-line callback dedents the entire body, and
the skill explicitly requires correct re-indentation when nesting genuinely
changed. Three kjnodes files fail on ~93% indentation-only lines that are
entirely mandatory.

**Provisional — cheap either way.** Compare whitespace-blind, and make it
advisory rather than gating.

---

## 6. Gap backlog ✅ (scope decided)

**Provisional scope:** every gap that is not cosmetic, and that does not
violate the sandbox around internal graph state and behaviour, gets implemented.
The ranking below is by observed functional loss, and is the part most worth
challenging — it decides what gets built first.

Ranked by functional loss observed in real packs:

| gap                                                                 | what breaks today                                                                                                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt-time widget value (old `widget.serializeValue`)              | kjnodes `screencap_stream` is inert; Impact Pack no longer embeds images in the workflow; VHS path widgets lost                                                                   |
| Workflow/prompt snapshot (`graphToPrompt`)                          | Crystools `Show Metadata` renders with no data                                                                                                                                    |
| Per-node-instance subscription                                      | `onExecuted`/`onConnectionsChanged` are per _type_, so a helper holding a `NodeHandle` cannot subscribe — cost VHS/kjnodes editors their "background from connected node" feature |
| Prompt queueing (`app.queuePrompt`)                                 | Impact Pack control-bridge cannot resume; LayerStyle Animation Builder button dead                                                                                                |
| App-chrome surface                                                  | Crystools monitor has nowhere to render — the pack's entire purpose                                                                                                               |
| Group API                                                           | no group concept at all; blocks UE matching and others                                                                                                                            |
| Node chrome / badges                                                | help buttons, progress badges, error highlighting                                                                                                                                 |
| Canvas/viewport (pan, zoom, screen↔graph, node rect, slot position) | floating docks, tooltips, gesture hit-testing                                                                                                                                     |
| Canvas-wide overlay drawing                                         | UE virtual links, node-insert previews                                                                                                                                            |
| Menus: submenus, visibility predicates, canvas and slot menus       | many packs                                                                                                                                                                        |
| Settings: `attrs` (min/max/step), value/label option pairs          | sliders lose bounds; UE settings undeclarable                                                                                                                                     |
| Localized slot names on `NodeDef`                                   | **locale-dependent silent prompt change** — see below                                                                                                                             |
| Slot colour in `SlotPatch`                                          | blocks an otherwise-clean UE file                                                                                                                                                 |
| Authenticated backend requests                                      | cloud uploads 401                                                                                                                                                                 |
| Undo-transaction grouping                                           | multi-link edits land as N undo steps                                                                                                                                             |
| Keybinding scope, command `active` state                            | shortcuts bind globally                                                                                                                                                           |

**Explicitly out of scope (cosmetic, will not support):** kjnodes
`canvas_background` (decorative canvas patterns) and `performance` (renderer
tuning flags). Note the second is _not_ cosmetic in the usual sense — two of its
five toggles change nothing on screen and exist purely for software renderers.
Recorded as _editor render-loop tuning, out of scope for the node API_ so the
eventual "panning got slow on my VM" report can be traced back here.

---

## 6a. Sanctioned hold-outs: workflow save/load 🟡

Some packs exist _to_ hook workflow save and load. `comfyui-workflow-encrypt`
encrypts the workflow itself; without a hook into serialization there is nothing
left of it. `comfyui-get-meta` and VHS's `videoinfo.js` want the other half —
opening a workflow parsed out of a file.

Neither `app.graphToPrompt()` nor `loadGraphData`/`handleFile` has a published
destination (gaps 26 and 30).

**Provisional:** allow these packs to keep hooking save/load on the old surface
rather than refusing them. The alternative is refusing a pack whose entire
purpose is that hook, which teaches us nothing.

Sites are marked in the converted source as:

```js
// SANCTIONED-HOLDOUT(workflow-save-load): <what this does, why it has no destination>
```

so they are greppable and can be retired the moment a document/workflow surface
exists. A file carrying one **will fail `retires-the-legacy-global` by design** —
that failure is the record, not a defeat, and should not be worked around.

**Open question.** Is a document/workflow surface in scope at all, or is
encrypt-the-workflow simply out of bounds for the node API? The answer decides
whether these hold-outs are temporary or permanent. If temporary, the marker
above is the migration list.

## 7. Two traps worth a second pair of eyes

**Localized slot names — a silent, locale-dependent prompt change.**
cg-use-everywhere builds its matching regex from `localized_name`. `NodeDef`
exposes only `{name, type}`. Substituting `name` looks harmless in English, but
matching is tested against `label || localized_name || name`, so in a
non-English locale `Seed Everywhere` **stops broadcasting and produces a
different prompt** — and the result is persisted into
`properties.ue_properties.input_regex` and `inputs[].label`. Nothing in the
harness would catch this. The conversion was reverted rather than shipped.

**`color_on` is serialized.** Writing `input.color_on` is a provable runtime
no-op (`renderingColor()` falls back to the same table), so deleting it looks
free — but `shallowCloneCommonProps` includes it, so dropping the write removes
`nodes[].inputs[].color_on` from every saved workflow. `SlotPatch` has no colour
field, so it can be neither set nor safely dropped.

---

## 6b. Capabilities built since this document was written ✅

Every one of these came from a pack that could not be converted without it, and
each closed a refusal rather than a nicety.

| capability                                                       | what it replaces                                           | what it unblocked                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `comfy.backend.assetUrl()`                                       | `api.fileURL`                                              | any pack serving its own images, fonts, html — `backend.url()` prepends `/api` and 404s |
| `node.getBounds()` / `node.getSlotPosition()` / `graph.nodeAt()` | packs re-deriving geometry from renderer constants         | retired `comfy.constants` entirely                                                      |
| `b.setExecution('frontend')`                                     | `node.isVirtualNode = true` on a _backend-registered_ type | enricos' `tools.js` — one line, whole file refused                                      |
| `comfy.storage`                                                  | `api.storeUserData` and friends                            | kjnodes' ideogram template store                                                        |
| `node.getScreenRect()`                                           | reading pan and zoom to place a panel over a node          | ideogram's floating dock                                                                |
| `comfy.onViewportChanged()`                                      | chaining a renderer draw callback                          | the same dock, and anything anchored                                                    |
| `defs.defineWidgetType()`                                        | `getCustomWidgets`                                         | **four files in comfy-mtb**, plus rmbg `COLORCODE` and mtb `FLOAT_CURVE`                |
| `widgets.mount({ defaultValue })`                                | a mounted control that holds a value                       | the root cause of most wire-format deltas                                               |

Two are worth reading as design notes rather than entries.

**`getScreenRect` instead of the viewport transform.** The dock needed "where is
this node on screen" and "tell me when that changed". Exposing pan and zoom
would have been the mechanism; these two are the intent. The arithmetic proves
it — the pan offset and canvas rect cancel out of the old expression, and the
zoom factor is recoverable as `getScreenRect().width / getBounds().width`. The
renderer's transform stays private and nothing is lost.

**`defineWidgetType` is not decoration.** The host decides widget-vs-socket by a
single lookup, and `addInputSocket`/`addInputWidget` are exact complements on
it. An unregistered type does not degrade to a plain widget — the input becomes
a **socket**, changing the serialized `inputs` array and dropping its
`widgets_values` entry. That is why three packs were refused rather than
converted with a warning.

### Still open, and now the largest items

- **Supply-side resolution** (§4) — cg-use-everywhere and rgthree.
- **Sidebar tabs** (gap 23) — mtb's input/output sidebar is entirely that.
- **A dialog surface** (gap 30) — mtb's `note_plus` needs an editor; several
  packs want a modal.
- **Prompt-time widget values** (gap 6) — still the most-cited functional loss:
  `screencap_stream` is inert, Impact Pack no longer embeds images, and
  prompt-reader's seed control would queue `-1`.
- **Prompt post-processing / node expansion** (new). `resolve` maps one output
  to one existing source or a literal; it cannot _add_ nodes to the prompt.
  Custom-Scripts' `repeater.js` patched `app.graphToPrompt` and cloned the
  upstream node once per repeat, so its `multi` and `create` modes are now
  inert — the largest single behaviour loss in that pack. Distinct from gap 6:
  that one wants a different _value_, this one wants a different _graph_.
- **A mounted widget cannot declare a fixed height** (new). Found independently
  by two agents on different packs, which is why it sits here rather than in a
  single report. `_arrangeWidgets` treats a widget with `computeSize` as fixed
  and one with only `computeLayoutSize` as growable; a `mount` is always the
  latter, and `MountDef.height` only sets `container.style.height` — an inline
  style _inside_ an allocation the renderer sized independently. So `height`
  pins content within a larger box, and a node with several fixed strips has
  its free space divided between them. Packs said this with
  `widget.computeSize = () => [w, h]`, which is unpublished. Corollary worth
  stating: for a panel meant to fill the node, passing `height` is actively
  wrong and omitting it is correct — the opposite of what the name suggests.
- **No pack-internal channel between files** (new, small but sharp). Packs
  publish helpers on the node class for their _own_ other files to call —
  `nodeType.prototype["pysssss.updateExamples"]`, called from two sibling
  files. Handles hold no arbitrary properties, so there is no destination. Both
  call sites were optional-chained, so the failure is silent degradation rather
  than a crash, which is worse. Note this is a pack talking to itself, not
  cross-pack coupling, so it does not raise the sandbox question the way a
  general extension registry would.

## 7a. Conversion keeps finding packs that were already broken

Worth knowing before reading any conversion result: some of what the migration
"loses" was never working.

**A copied-and-broken stylesheet idiom.** Three packs (~1.0M downloads) contain
`$el('style', { textContent: style })` where `style` is never declared anywhere
in the file — `comfyui-art-venture` (842K), `comfyui-workflow-encrypt` (169K)
and `comfyui-thumbnails` (8K). It throws a `ReferenceError` every load. In
workflow-encrypt it sits at module scope, so the whole file dies with it. Same
shape in all three: a template that propagated.

**Widgets already shadowed by core.** LayerStyle's DZ colour widget was
unreachable before we touched it — see §3. Removing it during conversion was not
a regression.

**Dead guards and inert code.** LanPaint's de-duplication guard compared a
widget's _name_ against a string that was actually its _value_, so it never
fired. kjnodes' `hideWidgetForGood` recursion passed two arguments in swapped
positions, so linked widgets were always re-enabled. Both were carried forward
faithfully or removed with the behaviour they never had.

The practical consequence: an upstream PR should state plainly which defects
pre-date the conversion, or the conversion gets blamed for them.

## 8. Bugs found in the node API itself

All found by converting real packs or loading them in a browser; **none** was
caught by the 255 unit tests covering this layer.

| bug                                                                 | effect                                                                                                                                                                                                        | status |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `NodeHandle.comfyClass` registered as a method, declared a property | read back as a bound function, so every `switch (node.comfyClass)` fell through silently — including the reference conversion given to every conversion agent                                                 | fixed  |
| `widgets.mount()` assigned `widget.onRemove`                        | shadowed the `DOMWidgetImpl` method that unregisters from the store; every mounted widget leaked for the page's lifetime                                                                                      | fixed  |
| `installNodeMoveBridge()` ran after `loadExtensions()`              | any pack subscribing to `comfy.onNodeMoved` at module scope threw                                                                                                                                             | fixed  |
| `setSizeConstraints` chained a new `onResize` per call              | handler list grew without bound; re-declaring added a competing clamp instead of replacing it                                                                                                                 | fixed  |
| `/comfy/api/v2.js` served by nothing                                | every converted pack failed at its first import; the harness masked it via its own loader hook                                                                                                                | fixed  |
| Frontend-node resolution never ran in `graphToPrompt`               | the resolution system was dead code in production                                                                                                                                                             | fixed  |
| `defs.define`'s generated class never set `serialize_widgets`       | the host's own node class sets it and `LGraphNode.serialize` gates `widgets_values` on it, so every defined node's widget values were dropped from the saved workflow — no error, visible only after a reload | fixed  |
| `NodeDef.inputs` discarded each input's declaration dict            | a pack declares bespoke keys on its own Python input spec and reads them back to drive the frontend; dropping them broke the pack against its own data, and blocked pysssss `binding.js` outright             | fixed  |

The pattern is consistent: this layer was a well-tested island that almost
nothing called. The check that finds these is _"which production code path calls
this, and what test covers that path"_ — not more unit tests.

---

## 8a. Decided this session: asks we are NOT building (cosmetic)

Ben's standing rule is that _all gaps that are not cosmetic, and do not violate
the sandbox around our internal graph state, must be implemented_. These three
landed on the cosmetic side and were closed rather than built. Provisional —
Christian's call, as with everything here.

| ask                                                                             | decision                                                       | reasoning                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A pack rebuilding the host UI, or injecting global CSS that restyles our chrome | **Not supported** — "we will not support a parallel front end" | Selector-coupled to markup we change freely; the same objection that excluded canvas painting                                                                                                             |
| A sanctioned way to re-theme Nodes 2.0                                          | **Should exist, not built** — Q9 in the API doc                | Distinct from the row above. A named CSS-variable contract is reviewable, versionable, and survives markup changes. Worth settling _before_ packs re-establish selector coupling against Nodes 2.0 markup |
| Slot `shape` on `SlotPatch`                                                     | **Not supported**                                              | Cosmetic, and exactly one call site in the whole corpus. Consequence: the saved `shape` byte is dropped — an accepted wire delta, recorded here so it is not discovered later as a surprise               |

The distinction that made the CSS question tractable: a pack styling **its own**
mounted widget DOM is legitimate and needs no API at all — it owns those
elements. Only a pack reaching **our** chrome is the parallel front end.

One correction belongs here too, because it was my error rather than a pack's:
conversion guidance told agents to route a pack's own asset paths through
`comfy.backend.assetUrl('/extensions/<pack>/…')`. That is wrong. ComfyUI serves
those files from the **install directory name**, which is chosen at install time
and can be renamed, so it cannot be written in source — `new URL(path,
import.meta.url)` is correct and always was. One pack ships two spellings of its
own directory with an `onerror` fallback between them, which is what guessing
costs. An agent pushed back on this guidance and was right; two call sites had
already been converted the wrong way and are fixed.

---

## 8b. The ceiling: packs that ship built output cannot be converted at all

This is structural, not a gap, and it belongs in the go/no-go rather than the
backlog. Magic Patch rewrites the JavaScript ComfyUI serves. Where that
JavaScript is **minified build output**, there is nothing to rewrite — the fix
has to happen upstream in a source repo we do not process.

`comfyui-easy-use` (#3, 3.3M downloads) is the confirmed case, and it is worth
reading closely because it is the worst shape this can take. Its `__init__.py`
sets `web_default_version = 'v2'`, so an install with no `config.yaml` — the
default — is served `web_version/v2`. That directory is the built artifact of a
**separate repository** (`yolain/ComfyUI-Easy-Use-Frontend`), wired in as a git
submodule, with no source in the distribution. It is also thoroughly coupled to
the old surface: one bundle alone carries 16 `registerExtension`, 93
`LiteGraph`, 46 `LGraphCanvas`, 7 `comfyAPI`. The `web_version/v1` tree we
converted is served only to users who explicitly opt in.

Measured across the top 135 packs (85.2M downloads, ≈80% of all):

| pack ships              | packs | downloads  | share     |
| ----------------------- | ----- | ---------- | --------- |
| no JavaScript at all    | 71    | 35,097,791 | **41.2%** |
| readable source         | 57    | 45,179,249 | **53.0%** |
| majority built/minified | 7     | 4,968,438  | **5.8%**  |

So ≈94% of downloads are reachable: 41% need nothing, 53% are convertible. The
ceiling is **5.8%**, and two packs are most of it — easy-use (3.3M) and
comfy-mtb (0.9M).

Two honest caveats. Only easy-use is _confirmed_ by reading its loader; the rest
are classified by a heuristic (majority of non-vendored JS bytes in files with

> 400-char mean line length, `.min.js`, or hashed bundle names). And the
> byte-majority test mis-reads packs that ship one large vendored bundle beside
> real source — `ComfyUI_LayerStyle_Advance` shows 8.2MB built against 1KB source,
> which is far more likely a vendored asset than a built frontend. **5.8% is
> therefore an upper bound.** An earlier, cruder version of this measurement said
> 14.7% by flagging a pack on any single built-looking file; that version wrongly
> condemned kjnodes and Impact Pack, both of which we have in fact converted.

What it means for the programme: artifact-level conversion cannot be the whole
answer, and should not be sold as one. For these packs the deliverable is an
upstream PR against the source repo, which is a different workflow with a
different cost — worth deciding before the go/no-go, not after.

---

## 8c. A class of conversion failure that no check could see

Worth recording because it changes what "verified" means, and because it was
found late.

A conversion that drops `import { app } from '.../scripts/app.js'` but leaves
`app.graph` in the body is **perfectly valid JavaScript**. It parses, so every
syntax check passes it. It throws `ReferenceError` at load and takes the whole
file with it. The conformance checker missed it too, because
`retires-the-legacy-global` looks for `app.registerExtension`, not a bare
`app.`.

Two ways it arose:

- **A dangling registration tail.** `crt-nodes/WAN_Compare.js` ended with
  `app.registerExtension(WANCompareExtension)` where _neither_ name was still
  defined — the body had already moved to `comfy.defs.extend`. One leftover
  line.
- **A body that was never finished.** Three files kept `app.graph`,
  `app.queuePrompt` and `api.fetchApi` throughout while their headers had been
  converted.

The fix is scope analysis, not pattern matching: `scripts/magic-patch/verify/undef.sh` runs
ESLint's `no-undef` over every converted file. Two details make it usable.
It compares against the **original**, because every pack has pre-existing
undefined names — script-tag globals like `marked`, `Sortable`, `ace` — and
without that subtraction the noise buries the signal (18 files flagged, 3 real).
And it deliberately is _not_ a `\bapp\.` regex, which false-positives on packs
that legitimately declare their own local named `api`.

Result across 453 converted files: **3 genuine breakages, all introduced by the
conversion**, in `prompt-assistant/captionFrame.js`,
`comfyui-enricos-nodes/compositor4.js` and `alekpet/painternode/helpers.js`.
All three were reverted to source, so those packs now honestly report the work
as outstanding rather than shipping a file that dies on load. Two of them sat in
packs previously reported as **complete**.

The lesson for the programme: "the conformance checker passes" is not the same
as "the file runs". The runtime load check in the harness is what closes this,
and it should be treated as load-bearing rather than optional.

---

## 9. What a go/no-go turns on

Three things, in order of how much they'd change the answer:

1. **§4 (supply-side resolution).** Decides whether broadcast/injection packs —
   cg-use-everywhere plus rgthree, ≈5.6% of downloads — are convertible at all.
   If they are not, the old surface cannot be deleted, which is the programme's
   premise.
2. **§1 and §2 (wire format).** Every conversion inherits whatever these settle.
   Re-deciding later means revisiting every pack already converted.
3. **§6 (gap scope).** The ranked list decides build order. Roughly a third of
   the entries are the difference between "the pack loads" and "the pack works".

Not blocking: §3 and §5 are cheap and reversible either way.

## 10. Status

**139 pass, 3 sanctioned hold-outs, 0 genuine failures** across every converted
file, run by the repo's own conformance checker.

Scope, measured honestly: a file counts only if it actually touches the old
surface (`scripts/app.js`, `registerExtension`, `window.comfyAPI`). Vendored
libraries, test suites, build tooling and packs' own standalone web apps are
excluded — which changes the picture enough to be worth stating, because the raw
file counts are badly misleading. `comfy-mtb` looked like 112 files of work and
is 2. `comfyui-lora-manager` looked like 180 and is 28; the other ~150 are its
separate model-manager web app and its test suite, neither of which ComfyUI ever
loads. On that basis: **131 files converted, 356 remaining, across 27 packs.**

The early sample below is kept because the per-pack results are still the most
concrete evidence of what conversion actually costs:

| pack              | rank | downloads | result                                                |
| ----------------- | ---- | --------- | ----------------------------------------------------- |
| kjnodes           | #1   | 4.0M      | 21/25 — 3 indentation heuristic, 1 documented partial |
| VideoHelperSuite  | #4   | 3.2M      | 3/3 — `VHS.core.js` 2570 → 1552 lines                 |
| Impact Pack       | #5   | 3.1M      | 7/7                                                   |
| Crystools         | #10  | 2.1M      | 6/6, 3 shim files deleted outright                    |
| LayerStyle        | #12  | 2.0M      | 3/3, 1 correctly untouched                            |
| cg-use-everywhere | #13  | 1.9M      | 2/20 — blocked on §4                                  |

That measurement has since been taken across the whole top 135 packs (together
≈80% of all downloads), and it is the single most encouraging number here:
**71 of the 135 ship no JavaScript at all** — 33% of packs, needing no work of
any kind. Only about 55 packs genuinely need converting. Counting those, roughly
**61% of downloads** are now either converted or provably need nothing.

Nothing is validated yet. `compile_db` ships only entries marked `validated`,
which requires a human to confirm the pack works.
