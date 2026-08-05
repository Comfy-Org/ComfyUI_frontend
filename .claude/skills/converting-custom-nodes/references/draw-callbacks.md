# Converting draw callbacks

`onDrawForeground`, `onDrawBackground`, `onDrawTitle*`, `onDrawCollapsed`.

**420 packs / 34.3M downloads / 32.2% of registry installs** touch these. They
are canvas-only, so they silently do nothing in Nodes 2.0 — no warning, no
error, no visible failure. That silence is why this cohort needs care.

## The hook name is misleading — most of it is not drawing

Measured over all **2,787 draw-callback bodies** in the corpus:

| What the body actually does | Bodies | % | Packs |
|---|---|---|---|
| Draws something | 1,468 | 52.7% | 289 |
| Prototype-patch plumbing | 901 | 32.3% | 198 |
| Layout / size enforcement — *no drawing* | 178 | 6.4% | 39 |
| State sync / polling — *no drawing* | 169 | 6.1% | 46 |
| DOM element sync — *no drawing* | 71 | 2.5% | 37 |

**47.3% never touch a drawing primitive. 127 packs hook a draw callback and
never draw at all.** They are using it as the only recurring callback available.

## Decide which of four things it is — before writing anything

```
Does the body call ctx.fillText/fillRect/drawImage/arc/... ?
├─ no
│  ├─ only calls the original (`orig?.apply(this, arguments)`) → DELETE (plumbing)
│  ├─ assigns this.size / ensureMinimumSize / computeSize   → setSizeConstraints
│  ├─ compares state and rebuilds on difference             → onChange
│  └─ toggles .hidden / .style / wrapperEl                  → widget mount lifecycle
└─ yes
   ├─ informational (text, badge, bar, border, tint, icon)  → node.decorations
   ├─ interactive (hit-testing, dragging, mouse handling)   → widgets.register()
   └─ arbitrary composition                                 → chrome.mount() escape hatch
```

## 1. Prototype plumbing — 32.3%, just delete it

```js
// before
const onDrawForeground = nodeType.prototype.onDrawForeground
nodeType.prototype.onDrawForeground = function (ctx) {
  const r = onDrawForeground?.apply?.(this, arguments)
  /* ...actual work... */
  return r
}
```

The capture-and-chain wrapper exists only because prototype patching has no
composition. Registered callbacks compose by construction, so the wrapper
disappears entirely — keep only the body.

This is the highest-volume, lowest-risk transform in the whole programme.

## 2. Size enforcement — 39 packs

```js
// before — re-asserted on every repaint
if (Number.isFinite(desired) && Math.abs(this.size?.[1] - desired) > 1) {
  this.size[1] = desired
}

// after — declared once
node.setSizeConstraints({ minHeight: desired })
```

`autoHeight: true` is usually what the pack actually wants: it added a DOM
widget of unknown height and hand-computed the node size to fit. In a
DOM-rendered node that is just layout, and needs no pack code at all.

## 3. Polling — 46 packs

```js
// before — string-joins every group title on every repaint, and mouse
// movement marks the canvas dirty, so this ran constantly
const titles = (app.graph._groups?.map(g => g.title) || []).join()
if (this.lastKnownGroupTitles !== titles) {
  this.lastKnownGroupTitles = titles
  rebuildUI(this)
}

// after
graph.onChange((ev) => {
  if (ev.has('group-state')) rebuildUI(node)
})
```

Pick the **narrowest** event. `node.onChange` fires only for that node;
`graph.onChange` is structural. Reaching for `graph.onChange` and filtering
one `ChangeKind` is a signal the scoped event is missing — worth reporting.

## 4. DOM visibility sync — 37 packs

```js
// before
node.painter.canvas.wrapperEl.hidden = this.flags.collapsed
```

A mounted DOM widget's lifecycle handles this. If you find yourself syncing an
element's visibility to node state, the element should be a widget.

## 5. Actual decoration — the informational half

Every canvas primitive in use has an exact DOM equivalent, so this is a
translation rather than a redesign:

| Canvas (packs using) | DOM/CSS |
|---|---|
| `fillText` 326, `measureText` 206 | a text node — measurement becomes free |
| `fillRect` 234 / `roundRect` 193 / `strokeRect` 159 | `background`, `border-radius`, `border` |
| `drawImage` 203 | `<img>` |
| `arc` 181 / `ellipse` 58 | `border-radius: 50%` |
| `translate` 170 / `rotate` 136 | `transform` |
| `globalAlpha` 150 | `opacity` |
| `clip` 138 | `overflow: hidden` |
| `setLineDash` 115 | `border-style: dashed` |
| `shadowBlur` 95 | `box-shadow` |
| `createLinearGradient` 79 | `linear-gradient()` |

```js
// before — ComfyUI-Custom-Scripts mathExpression.js, ran every repaint
nodeType.prototype.onDrawForeground = function (ctx) {
  const v = app.nodeOutputs?.[this.id]
  if (!this.flags.collapsed && v) {
    ctx.save()
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(v.value[0], x, y)
    ctx.restore()
  }
}

// after — set when the value changes
node.decorations.set('output-value', {
  kind: 'badge',
  anchor: 'overlay-top-right',
  text: String(value)
})
```

Decorations are **keyed**, so repeated calls update rather than accumulate —
which is the common bug when porting from a per-repaint callback.

Use `anchor`, never pixel coordinates: canvas-space pixels do not survive DOM
layout, and anchors are what let one declaration render in *both* modes. For
per-slot markers (rgthree status text, impact-pack's red X over an incompatible
slot) use `{ slot: ref, side: 'input' | 'output' }`.

**Declarative, not a DOM mount** — a declaration renders to canvas *and* DOM. A
mount only works in Nodes 2.0, so the pack would have to keep its canvas code
forever and the hooks could never be deleted.

## 6. Interactive controls — becomes a widget

```js
// mxtoolkit Slider2D.js — a full draggable 2D slider painted by hand
this.node.onDrawForeground = function (ctx) {
  ctx.fillStyle = 'rgba(20,20,20,0.8)'
  ctx.beginPath()
  ctx.roundRect(shiftLeft - 4, shiftLeft - 4, ...)
  ctx.fill()
  // dots, handles, hit-testing...
}
```

This is not decoration. It was painted by hand because no custom-widget API
existed. It becomes `comfy.widgets.register({ type, mount })` — a real rewrite,
roughly an eighth of the cohort, and the part most likely to need the pack
author.

## The trap: frame to event

A draw callback recomputes from current state on every repaint, so **nothing
ever needs to announce a change**. After conversion, decorations must be set
*when the value changes*.

A naive port that calls `decorations.set()` from inside the old callback body
will appear to work — and quietly run on every repaint forever. No error, no
crash, just a slow node. Worth a lint rule and a dedicated probe.

## What you can stop doing

- **LOD checks.** rgthree hand-rolls `canvas.ds.scale < 0.6` to skip drawing
  when zoomed out. Handled centrally now.
- **Collapsed checks.** `if (this.flags.collapsed) return` — layout's problem.
- **Defensive try/catch around drawing.** Several packs wrap draw calls to avoid
  breaking node rendering; decorations cannot throw into the render path.

## Source data

Measured over `~/comfy/nodes-compat-study/corpus/registry_js` (4,969 packs).
Counts are grep-derived and have a known false-positive rate — sample-verify
before citing any individual number.
