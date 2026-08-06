> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> Companion to `magic_patch_WIP.md` and `node_api_WIP.md`. Becomes part of an
> ADR or a QA doc once the approach settles.

# Testing a converted pack by hand

`verify_db` proves something narrow and worth stating exactly: **the pack loads,
registers the same node types, constructs them, and serialises identically**.
It drives node lifecycle only. It does not click anything, does not render, and
**never calls a converted file's exported helpers** — which is how a broken
`hideWidgetForGood` passed it earlier.

So a human pass is not belt-and-braces. It covers a different surface.

## Setup

```bash
# 1. The converted pack, from the entry the agent worked in
db/<pack>/<commit7>/v1/…        # upgraded code
db/<pack>/<commit7>/…           # the pack as shipped, for comparison

# 2. Install both into a real ComfyUI
cp -r db/<pack>/<commit7>/<packRoot>  ~/comfy/ComfyUI/custom_nodes/<pack>-before
cp -r db/<pack>/<commit7>/v1/<packRoot> ~/comfy/ComfyUI/custom_nodes/<pack>-after
```

Test **A/B, one at a time** — install one, restart, exercise, then swap. Both at
once means two packs registering the same node types, and whichever loses is
not a finding about the conversion.

Run each pass **twice**: once on the legacy canvas renderer and once with Nodes
2.0. Anything mounted (`widgets.mount`, `widgets.canvas`) renders through a
different path in each, and that is exactly where a conversion can look right in
one and be invisible in the other.

## What to check, in order of what has actually broken

**1. It loads at all.** Open the browser console before anything else. A
converted file that throws at registration takes out _every_ node type in the
pack — that happened, and the whole pack silently vanished from the node menu.

- [ ] No errors in console at startup
- [ ] Every node type still appears in the Add Node menu (compare against before)

**2. Each node still constructs.** Drop one of every type on the canvas.

- [ ] Node appears, with the same widgets in the same order
- [ ] Widget defaults match the before-install
- [ ] Node size/colour/title match

**3. Widget behaviour.** For each widget the conversion touched:

- [ ] Changing a value updates the node
- [ ] Values that drive other widgets (combos, toggles) still do
- [ ] A widget that should be hidden is hidden, and one that should be disabled
      is greyed but readable

**4. Execution.** Queue a prompt that runs each node.

- [ ] Node executes without console errors
- [ ] Any on-node display (text readouts, previews, progress) still updates
- [ ] Re-running does not accumulate widgets — the remove-then-recreate pattern
      is where duplicates appear

**5. Save and reload — the wire format.** This is the invariant the whole
migration promises.

- [ ] Save the workflow. Reload the page. Load it back.
- [ ] Widget values restored exactly
- [ ] `diff` the saved JSON against one saved from the before-install with the
      same graph: **it should be byte-identical** apart from node ids
- [ ] Queue from the reloaded workflow and confirm the same result

**6. Interaction, for anything mounted.** `verify_db` cannot see any of this.

- [ ] Mounted controls (editors, previews, panels) draw
- [ ] Dragging, clicking and hovering work
- [ ] Resizing the node reflows the mounted element
- [ ] Deleting the node leaves nothing behind — no orphaned DOM, no timer still
      firing, no listener still bound (check the console after deleting)

**7. Coexistence.** Convert one pack, not all of them.

- [ ] Install the converted pack **alongside unconverted ones** and confirm both
      still work. Composition is the thing the published API claims to fix; a
      pack that only works alone has not demonstrated it.

## Pack-specific: kjnodes

Its signature features are the ones most likely to break:

- [ ] **Multi combiners** (`ImageBatchMulti`, `JoinStringMulti`, …) — wiring the
      last input grows a new one; unwiring shrinks it
- [ ] **`SetNode` / `GetNode`** — set a key on one, read it on another, confirm
      the wire resolves and the prompt runs
- [ ] **Point / spline editors** — drag a handle, add a point, delete one; save
      and reload and confirm the curve survives
- [ ] **`PlaySoundKJ`** — plays on completion, honours the mode widget, does not
      play twice

## Recording the result

Anything that fails is worth more than the fix: it is a hole in `verify_db`.

For each failure record **what broke**, **which of the seven sections found it**,
and **whether an automated check could have**. A failure in section 5 means the
wire comparison missed something; a failure in section 6 is expected, and the
question is whether it can be driven in the harness at all.
