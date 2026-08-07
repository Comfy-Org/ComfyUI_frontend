> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> Companion to `magic_patch_WIP.md`, `node_api_WIP.md` and
> `magic_patch_test_plan_WIP.md`.

# Implementation questions — node API / Magic Patch

**The design is settled. Everything here is an implementation issue.** Each
entry surfaced from converting real packs onto the published node API
(`src/platform/nodeApi/`) and loading them in a real ComfyUI — defects, format
mismatches, and places where the implementation does not yet reach what the
design already calls for.

**Christian makes the final call on all of it.** The choices recorded below were
taken to unblock a proof of concept and get it to a go/no-go, not to settle
policy. Where one was made to keep moving, it is marked _provisional_ and the
reasoning is written out so it can be overturned cheaply. Several have blast
radius well beyond this programme, and are flagged as such.

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

## 2. What "byte-identical wire format" means for mounted widgets 🟡

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

**Provisional:** make the serialization match the legacy behaviour, and
maintain compatibility — `MountDef` should expose both flags rather than
conflating them, defaulting to what `addDOMWidget` did.

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

## 8. Bugs found in the node API itself

All found by converting real packs or loading them in a browser; **none** was
caught by the 255 unit tests covering this layer.

| bug                                                                 | effect                                                                                                                                                        | status |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `NodeHandle.comfyClass` registered as a method, declared a property | read back as a bound function, so every `switch (node.comfyClass)` fell through silently — including the reference conversion given to every conversion agent | fixed  |
| `widgets.mount()` assigned `widget.onRemove`                        | shadowed the `DOMWidgetImpl` method that unregisters from the store; every mounted widget leaked for the page's lifetime                                      | fixed  |
| `installNodeMoveBridge()` ran after `loadExtensions()`              | any pack subscribing to `comfy.onNodeMoved` at module scope threw                                                                                             | fixed  |
| `setSizeConstraints` chained a new `onResize` per call              | handler list grew without bound; re-declaring added a competing clamp instead of replacing it                                                                 | fixed  |
| `/comfy/api/v1.js` served by nothing                                | every converted pack failed at its first import; the harness masked it via its own loader hook                                                                | fixed  |
| Frontend-node resolution never ran in `graphToPrompt`               | the resolution system was dead code in production                                                                                                             | fixed  |

The pattern is consistent: this layer was a well-tested island that almost
nothing called. The check that finds these is _"which production code path calls
this, and what test covers that path"_ — not more unit tests.

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

Six packs converted, independently verified with the repo's own conformance
checker: **42 pass, 4 fail, 24 correctly unchanged, 3 deleted.**

| pack              | rank | downloads | result                                                |
| ----------------- | ---- | --------- | ----------------------------------------------------- |
| kjnodes           | #1   | 4.0M      | 21/25 — 3 indentation heuristic, 1 documented partial |
| VideoHelperSuite  | #4   | 3.2M      | 3/3 — `VHS.core.js` 2570 → 1552 lines                 |
| Impact Pack       | #5   | 3.1M      | 7/7                                                   |
| Crystools         | #10  | 2.1M      | 6/6, 3 shim files deleted outright                    |
| LayerStyle        | #12  | 2.0M      | 3/3, 1 correctly untouched                            |
| cg-use-everywhere | #13  | 1.9M      | 2/20 — blocked on §4                                  |

≈11.4% of all downloads converted. A further **6.9%** ships no JavaScript at
all (`comfyui_controlnet_aux`, `ComfyUI-GGUF`, `comfyui-impact-subpack`) and
needs no work — worth measuring across the whole top 135 before sizing the
remaining effort.

Nothing is validated yet. `compile_db` ships only entries marked `validated`,
which requires a human to confirm the pack works.
