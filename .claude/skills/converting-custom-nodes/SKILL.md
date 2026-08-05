---
name: converting-custom-nodes
description: 'Converts third-party custom-node JS off deprecated/unpublished ComfyUI APIs onto the published node API. Use for Magic Patch conversion work, migrating a pack, or reviewing a generated patch. Triggers on: convert custom node, magic patch, migrate pack, port to node API, output.links, input.link, widgets.splice, converted-widget.'
---

# Converting Custom Nodes

Converts third-party pack JS from the old, unpublished ComfyUI internals onto
the published node API (`src/platform/nodeApi/`, specified in `NODE_API.md`).

This is **migration, not compatibility work**. The goal is that the old surface
can be *deleted*, so never add a shim — rewrite the call site.

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
*and* the converted source) and `fix` (must fail before, pass after). If you
cannot state an equivalence claim, you do not yet understand the code well
enough to convert it.

## Steps

### 1. Read what the code is actually doing

Do not pattern-match on the API name. The census surfaces are misleading:

- A `widgets.splice(i, 1)` immediately followed by `splice(i, 0, w)` is **not a
  reorder** — it is a cache-invalidation hack. Replace it with
  `widget.setOptions()`, which invalidates properly.
- `onDrawForeground` is often **not drawing**. 47% of draw-callback bodies never
  touch a drawing primitive; they enforce size, poll for changes, or sync DOM
  visibility. Those become `setSizeConstraints`, `onChange`, and the widget
  mount lifecycle respectively.

### 2. Check whether the object is live or serialized

**The single most dangerous confusion in this work.** These look identical:

```js
node.inputs[0].link = null                    // live slot — convert
p.workflow.nodes[i].inputs[0].link = null     // serialized JSON — LEAVE ALONE
```

The second is correct as written; rewriting it corrupts a working pack. Trace
the variable to its origin before touching anything named `link`, `links`,
`inputs`, `outputs` or `widgets`. If it came from `graphToPrompt`, a fetch, a
`JSON.parse`, or a `.workflow` property, it is data — not a graph.

### 3. Apply the mapping

| Old | New | Notes |
|---|---|---|
| `output.links.push(id)` | `output.connectTo(nodeId, inputRef)` | creating a connection |
| moving links between own outputs | `output.moveLinksTo(ref)` | **preserves link ids** — required for the wire gate |
| `output.links` (read) | `output.links()` | frozen snapshot, safe to iterate while disconnecting |
| `input.link = null` | `input.disconnect()` | check step 2 first |
| `input.link` (read) | `input.source()` / `input.isConnected` | |
| `node.type = x` | delete it, or `graph.replaceNode()` | usually a defensive no-op — just remove the line |
| `slot.type = x`, `slot.name = x` | `slot.modify({ type, name })` | atomic, one undo step; keeps existing links |
| `widget.type = 'converted-widget'` | `widget.hidden = true` | ⚠️ old hack also suppressed serialization — see `references/widgets.md` |
| `widgets.splice` to reorder | `widgets.reorder(names)` | throws on a partial list instead of dropping widgets |
| `widgets.splice(i,1)` + `splice(i,0,w)` | `widget.setOptions(...)` | same index in/out = cache invalidation, **not** a reorder |
| `widgets.push(w)` | `widgets.add(def)` | |
| `widgets = [...]` / `widgets.length = n` | `widgets.remove(name)` | assignment drops renderer tracking; length skips teardown |
| `getCustomWidgets` POJO | `comfy.widgets.register({ type, mount })` | |
| `{...input}` / `{...node}` | `.snapshot()` | accessors moved to the prototype, so spread yields nothing |
| `nodeType.prototype.onNodeCreated = ...` | `defs.extend(sel, b => b.onCreated(...))` | selector = the hook's existing guard clause |
| `nodeType.prototype.onExecuted = ...` | `b.onExecuted(node, result)` | see `references/node-definitions.md` |
| `nodeType.prototype.onConfigure = ...` | `b.onConfigured(node, data)` | |
| `nodeType.prototype.onRemoved = ...` | `b.onRemoved(node)` | |
| `widget.inputEl` | `widget.element` | renamed in PR #8594 |
| `this.widgets.length = n` | remove by name | assigning length skips widget teardown |
| `+!!this.inputs[0].widget` | `input.isWidgetInput` | converted-widget sniffing |
| `onDrawForeground` (drawing) | `node.decorations.set(key, dec)` | renders in canvas *and* Nodes 2.0 |
| `onDrawForeground` (sizing) | `node.setSizeConstraints({ autoHeight })` | see `references/draw-callbacks.md` |
| `onDrawForeground` (polling) | `node.onChange` / `graph.onChange` | pick the narrowest event |
| `extends LGraphNode` | `defs.define({ type, ... })` | virtual nodes use `resolve(ctx)` |

Prefer `comfy.supports('...')` over version comparisons — see `NODE_API.md` §2.

### 4. Watch for the frame-to-event shift

A draw callback recomputed from current state every repaint, so nothing ever
needed to announce a change. Declarations and decorations must be **set when the
value changes**. A port that calls `decorations.set()` from inside the old
callback body will appear to work and quietly run on every repaint forever.

### 5. Write the test before claiming success

State an equivalence claim and a fix claim. Run the file against both sources:
equivalence green on both, fix red on the original and green on the converted.
A fix-only test proves the conversion did *something*, not that it was safe.

### 6. Refuse when you should

Escalate or decline rather than guess when:

- You cannot tell whether the object is live or serialized (step 2).
- The replacement depends on intent you cannot recover — e.g. re-homing links
  versus rebuilding a mirror have different correct answers.
- The published API has no destination. A missing API is a **core gap to file**,
  not something to work around in a pack. `NODE_API.md` §1 lists what is and is
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

## Pattern references

Deep dives, loaded only when relevant. `SKILL.md` stays short on purpose; detail
lives here.

| Reference | Covers |
|---|---|
| `references/node-definitions.md` | `beforeRegisterNodeDef` + prototype patching — **1,265 packs, 47.4% of installs, the largest surface**. The selector is already written as the hook's guard clause. |
| `references/widgets.md` | Widget-array mutation and the converted-widget protocol — 286 packs / 21.6%, overlapping cohorts totalling more. Where naive conversions are most often silently wrong. |
| `references/draw-callbacks.md` | `onDraw*` — 420 packs, 32.2% of installs. Measured breakdown showing 47% never draw at all, a decision tree, and the canvas→CSS mapping. |

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

| | |
|---|---|
| Published API spec | `NODE_API.md` |
| Published API code | `src/platform/nodeApi/` |
| Rule catalog (per-pattern guidance) | `src/workbench/extensions/magicPatch/conversion/rules.ts` |
| Verdict grading | `src/workbench/extensions/magicPatch/verify/verdict.ts` |
| Programme design | `MAGIC_PATCH.md` |

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
