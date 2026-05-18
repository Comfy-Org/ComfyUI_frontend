/**
 * CoordSpaceDemo — canary example for the D-coord-space PICK
 * (W6.P4 ACCEPTED 2026-05-18, Axiom A13 Single Coordinate Space).
 *
 * Shows three things:
 *
 * 1. **The default — canvas units everywhere.** `node.getPosition()` /
 *    `getSize()` / `setPosition()` / `setSize()` all speak canvas units.
 *    Zoom and pan don't perturb the numbers; devicePixelRatio is
 *    invisible. This is the path 96%+ of extensions should ever take.
 *
 * 2. **The escape-hatch — explicit + annotated.** For the legitimate
 *    cases that need screen-space coords (custom GPU canvas, floating
 *    overlay anchored to absolute browser coords, hi-DPI export math),
 *    drop to `window.app.canvas.{ds,canvas}` + `window.devicePixelRatio`.
 *    Every escape-hatch use site MUST carry the
 *    `// escape-hatch — see D-coord-space.md` comment so reviewers
 *    (human or AI) can see the dependency is deliberate.
 *
 * 3. **The cliff — what's NOT on the public surface.** No
 *    `node.getScreenPosition()`, no `node.getCSSPosition()`, no
 *    `space: 'client' | 'css'` parameter, no branded `ClientPoint`
 *    type. Reaching for any of those is a sign the author wants the
 *    escape-hatch.
 */

import { defineExtension, defineNode, type NodeHandle } from '@/extension-api'

defineNode({
  name: 'Comfy.CoordSpaceDemo.V2',

  nodeCreated(node: NodeHandle) {
    // ── (1) Default path: canvas units, no conversion needed ──────────
    const [x, y] = node.getPosition() // canvas units
    const [w, h] = node.getSize() //     canvas units

    // Move a node 16 canvas units down-and-right of its current spot.
    // No /scale, no *scale, no devicePixelRatio — the runtime owns it.
    node.setPosition([x + 16, y + 16]) // canvas units

    // Reserve a minimum size — also canvas units; zoom doesn't matter.
    if (w < 200) node.setSize([200, h])
  }
})

defineExtension({
  name: 'Comfy.CoordSpaceDemo.V2.Escape',

  setup() {
    // ── (2) Escape-hatch path — explicit + annotated ──────────────────
    //
    // Use case: extension wants to draw a 2x-pixel-density preview
    // thumbnail PNG of the visible viewport. PNG export needs *device
    // pixels* (so the saved image is crisp on hi-DPI displays); the v2
    // public surface does not expose dpr or screen-pixel sizing.
    //
    // The escape-hatch is the same shape extension authors are already
    // using today (213 dpr hits across 27 repos in the W6.P4.R1 sweep).

    // escape-hatch — see D-coord-space.md § Documentation contract
    const dpr = window.devicePixelRatio
    // escape-hatch — see D-coord-space.md § Documentation contract
    const canvas = globalThis.app?.canvas
    if (!canvas) return
    // escape-hatch — see D-coord-space.md § Documentation contract
    const { scale } = canvas.ds
    // escape-hatch — see D-coord-space.md § Documentation contract
    const rect = canvas.canvas.getBoundingClientRect()

    // From here, the author owns dpr math + canvas↔screen conversions.
    // The runtime makes no stability promise about ds.scale or the
    // shape of window.app.canvas — escape-hatch is intentionally
    // fragile per Axiom A13.
    void { dpr, scale, rect }
  }
})
