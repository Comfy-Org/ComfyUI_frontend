import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'

const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent
const FIT_VIEW_LABEL = /^Fit View/

/** Screen-space boxes of every graph node, via the canvas' own transform. */
async function nodeScreenBoxes(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const canvas = window.app!.canvas
    const canvasRect = (
      canvas.canvas as HTMLCanvasElement
    ).getBoundingClientRect()
    return window.app!.graph.nodes.map((node) => {
      const [left, top] = canvas.ds.convertOffsetToCanvas([
        node.pos[0],
        node.pos[1]
      ])
      const [right, bottom] = canvas.ds.convertOffsetToCanvas([
        node.pos[0] + node.size[0],
        node.pos[1] + node.size[1]
      ])
      return {
        id: String(node.id),
        left: left + canvasRect.left,
        right: right + canvasRect.left,
        top: top + canvasRect.top,
        bottom: bottom + canvasRect.top
      }
    })
  })
}

test.describe('In-App Agent panel dock layout', { tag: '@cloud' }, () => {
  // PM-630 X-01 — the dock takes a third of the viewport, capped at 420px.
  test.describe('at a wide viewport', () => {
    test.use({ viewport: { width: 1600, height: 900 } })

    test('caps the dock width at 420px', async ({ page, agentFlagEnabled }) => {
      await bootAgentApp(page, agentFlagEnabled)
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()
      // A third of 1600 is 533, so the max-width is what binds here.
      await expect
        .poll(() => panel.boundingBox().then((box) => Math.round(box!.width)))
        .toBe(420)
    })
  })

  test.describe('at a narrow viewport', () => {
    test.use({ viewport: { width: 900, height: 900 } })

    test('falls back to a third of the viewport below the cap', async ({
      page,
      agentFlagEnabled
    }) => {
      await bootAgentApp(page, agentFlagEnabled)
      await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

      const panel = page.getByTestId('docked-agent-panel')
      await expect(panel).toBeVisible()
      await expect
        .poll(() => panel.boundingBox().then((box) => Math.round(box!.width)))
        .toBe(300)
    })
  })

  // PM-630 T-30 / FE-1285 — the canvas/dock seam is a real border over an
  // opaque fill, so the canvas never shows through the panel.
  test('separates the dock from the canvas with an opaque bordered surface', async ({
    page,
    agentFlagEnabled
  }) => {
    await bootAgentApp(page, agentFlagEnabled)
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const surface = page.getByTestId('docked-agent-panel').locator('> div')
    await expect(surface).toBeVisible()

    const style = await surface.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        borderLeftWidth: computed.borderLeftWidth,
        borderLeftStyle: computed.borderLeftStyle,
        borderLeftColor: computed.borderLeftColor,
        backgroundColor: computed.backgroundColor
      }
    })

    expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0)
    expect(style.borderLeftStyle).toBe('solid')
    // A transparent border or fill would let the canvas read through the seam.
    expect(style.borderLeftColor).not.toMatch(/rgba\(0, 0, 0, 0\)$/)
    expect(style.backgroundColor).not.toMatch(/rgba\(0, 0, 0, 0\)$/)
  })

  // PM-630 T-06 / FE-1633 — Fit View must frame the graph in the region the
  // dock leaves visible. The canvas element itself always spans the full
  // window (`absolute inset-0 size-full`) with the dock painted over it, so
  // this is a claim about where the *content* lands, not about the canvas box.
  test('frames the graph clear of the docked panel on Fit View', async ({
    page,
    agentFlagEnabled
  }) => {
    test.fixme(
      true,
      'Panel-aware Fit View ships on the agent v1/v2 lineage, not main: no ' +
        'fit-view path here consults the agent panel store, and this run ' +
        'leaves nodes under the dock. Verified passing against the deployed ' +
        'agent build 23a80476 (PM-630 T-06 / FE-1633); enable when the fix lands.'
    )

    await bootAgentApp(page, agentFlagEnabled)
    await page.getByRole('button', { name: OPEN_AGENT_LABEL }).click()

    const panel = page.getByTestId('docked-agent-panel')
    await expect(panel).toBeVisible()

    await page.getByRole('button', { name: FIT_VIEW_LABEL }).click()

    const panelBox = (await panel.boundingBox())!
    // Fit View animates, so poll the framing rather than sampling once.
    await expect
      .poll(async () => {
        const boxes = await nodeScreenBoxes(page)
        return boxes.filter((box) => box.right > panelBox.x + 2).length
      })
      .toBe(0)

    // Clearing the dock is trivially satisfiable by zooming far out, so also
    // require Fit View to use the space it has.
    const boxes = await nodeScreenBoxes(page)
    expect(boxes.length).toBeGreaterThan(0)
    const framedWidth =
      Math.max(...boxes.map((box) => box.right)) -
      Math.min(...boxes.map((box) => box.left))
    expect(framedWidth).toBeGreaterThan(panelBox.x * 0.25)
  })
})
