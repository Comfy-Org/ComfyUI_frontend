import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Regression test: the graph-canvas-panel SplitterPanel must not clip
 * absolutely-positioned children (like GraphCanvasMenu).
 *
 * PrimeVue applies `overflow: hidden` to all SplitterPanels by default.
 * Without an explicit `overflow-visible` override, the bottom-right canvas
 * toolbar becomes invisible on mobile viewports where the panel's bounding
 * box is smaller than the full canvas area.
 *
 * @see https://www.notion.so/Bug-Graph-canvas-toolbar-not-visible-on-mobile-3246d73d36508144ae00f10065c42fac
 */
describe('LiteGraphCanvasSplitterOverlay', () => {
  it('graph-canvas-panel has overflow-visible to prevent clipping toolbar on mobile', () => {
    const filePath = resolve(__dirname, 'LiteGraphCanvasSplitterOverlay.vue')
    const source = readFileSync(filePath, 'utf-8')

    // The SplitterPanel wrapping graph-canvas-panel must include overflow-visible
    // to override PrimeVue's default overflow:hidden on .p-splitterpanel.
    // Without this, GraphCanvasMenu (absolute right-0 bottom-0) gets clipped on mobile.
    expect(source).toMatch(
      /class="[^"]*graph-canvas-panel[^"]*overflow-visible/
    )
  })
})
