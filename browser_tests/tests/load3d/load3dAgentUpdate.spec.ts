import { expect } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { load3dAgentTest as test } from '@e2e/fixtures/load3dAgentFixture'
import { Load3DViewerHelper } from '@e2e/tests/load3d/Load3DViewerHelper'

// The `1rem` the viewer's own width cap reserves inside the visible workspace:
// `max-w-[min(80vw,calc(100vw-var(--workspace-inset-right,0px)-1rem))]`. Not
// shared with the dialog clamp's own `0.5rem` gutter floor, which is a separate
// production value that only happens to be half of this one.
const VIEWER_CAP_RESERVE = 16

// The slack the rest of this file already allows on bounding boxes, so a
// fractional panel width or transform rounding cannot turn a correct layout
// into a failure. Note `toBeCloseTo`'s second argument is a digit count, not
// pixels, so it cannot express this.
const PIXEL_SLACK = 1

function expectPixels(actual: number, expected: number, label: string): void {
  expect(actual, label).toBeGreaterThanOrEqual(expected - PIXEL_SLACK)
  expect(actual, label).toBeLessThanOrEqual(expected + PIXEL_SLACK)
}

test.describe('Load3D agent updates', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('retires an incompatible replacement link without blocking the next agent edit', async ({
    load3dAgent
  }) => {
    await load3dAgent.expectRenderedLinks([[9, '1', 0, '2', 0, 'IMAGE']])

    load3dAgent.replaceLinkWithIncompatibleTarget()
    await load3dAgent.expectRenderedLinks([])
    load3dAgent.expectHostLink([9, 1, 0, 3, 0, 'STRING'])

    load3dAgent.setModelFromAgent('cube.obj')
    await load3dAgent.expectModel('cube.obj')
    await expect(load3dAgent.viewer.node).toBeVisible()
  })

  test('an agent model_file update refreshes the viewer and capture cache', async ({
    load3dAgent
  }) => {
    const { viewer } = load3dAgent

    const before =
      await test.step('capture the initial agent model', async () => {
        load3dAgent.setModelFromAgent('cube.obj')
        await load3dAgent.expectModel('cube.obj')
        await viewer.waitForModelLoaded()
        return load3dAgent.capture()
      })

    const after =
      await test.step('queue after the agent replacement finishes loading', async () => {
        load3dAgent.setModelFromAgent('workflow.glb')
        await load3dAgent.expectModel('workflow.glb')
        await load3dAgent.viewer.waitForModelLoaded()
        return load3dAgent.capture()
      })

    await test.step('the prompt carries the replacement model', async () => {
      expect(after.promptImage).not.toBe(before.promptImage)
      expect(after.imageBytes.byteLength).toBeGreaterThan(0)
      expect(after.imageBytes).not.toEqual(before.imageBytes)
      await expect(viewer.canvas).toBeVisible()
      await test.info().attach('agent-updated-load3d.png', {
        body: await viewer.node.screenshot(),
        contentType: 'image/png'
      })
    })
  })

  test('keeps the full-screen viewer inside the visible workspace inset', async ({
    load3dAgent,
    page
  }) => {
    const viewer = new Load3DViewerHelper(page)
    const panel = page.getByTestId('docked-agent-panel')

    await test.step('open the viewer from an agent-updated node', async () => {
      load3dAgent.setModelFromAgent('cube.obj')
      await load3dAgent.expectModel('cube.obj')
      await load3dAgent.viewer.waitForModelLoaded()
      await load3dAgent.viewer.openViewerButton.click()
      await viewer.waitForOpen()
    })

    await test.step('centre the viewer beside the panel above the sm breakpoint', async () => {
      // The viewer keeps its own inset-aware width cap while every other dialog
      // now resolves against the raw viewport. The cap is declared twice —
      // unprefixed and `sm:`-prefixed — because the `full` dialog size already
      // ships `sm:max-w-[calc(100vw-1rem)]`, which outranks an unprefixed cap
      // above the breakpoint, so only the prefixed declaration is live here.
      // The narrow-viewport steps below run under `sm:` and cannot see it: drop
      // it and they still pass while the viewer covers the panel.
      //
      // This dialog is always on the centring term of the clamp's `max()`,
      // never its 0.5rem gutter floor: the cap holds the width at or under
      // `100vw - inset - 1rem`, which leaves centring at least 8px, so the
      // floor can at best tie. That makes the viewer's x unusable as evidence
      // on its own, and a floor assertion here vacuous. What is asserted is
      // the width the live cap produces, which is what dropping the prefixed
      // declaration changes, and equal gutters either side of the viewer. The
      // floor itself is covered by `dialogAgentPanelInset.spec.ts`, where a
      // dialog without an inset-aware cap does sit on it.
      for (const width of [1280, 1920, 2560]) {
        await page.setViewportSize({ width, height: 800 })

        await expect(async () => {
          const dialogBox = await viewer.dialog.boundingBox()
          const panelBox = await panel.boundingBox()
          const inset = await page.evaluate(
            (property) =>
              parseFloat(
                document.documentElement.style.getPropertyValue(property)
              ) || 0,
            '--workspace-inset-right'
          )
          expect(dialogBox).not.toBeNull()
          expect(panelBox).not.toBeNull()
          if (!dialogBox || !panelBox) return

          // The panel is docked against the right edge, so its left edge is the
          // boundary of the visible workspace. Its width is the resizable
          // `draggedWidth`, so derive everything from the measured box rather
          // than pinning coordinates that only hold at its default width.
          expectPixels(
            panelBox.x + panelBox.width,
            width,
            'the panel is flush with the right edge'
          )

          // The panel publishes its width as the inset only while it is docked
          // and not overlaying; in overlay mode it covers the right edge with
          // an inset of 0, and the viewer is then correctly wider than the
          // workspace. Pin the mode so a failure below is attributable to the
          // viewer rather than to the panel having gone into overlay.
          expectPixels(
            inset,
            panelBox.width,
            'the docked panel publishes its width as the workspace inset'
          )

          // `min(80vw, 100vw - inset - 1rem)`. Above ~2180px at the default
          // panel width the 80vw term is the smaller one and the cap stops
          // binding, which is correct and must not fail the step.
          expectPixels(
            dialogBox.width,
            Math.min(width * 0.8, width - inset - VIEWER_CAP_RESERVE),
            'the viewer fills the workspace up to its own 80vw width'
          )

          expectPixels(
            panelBox.x - (dialogBox.x + dialogBox.width),
            dialogBox.x,
            'the viewer sits centred between the viewport and panel edges'
          )
        }).toPass({ timeout: 5000 })
      }
    })

    await test.step('keep the viewer outside the docked Agent panel', async () => {
      await page.setViewportSize({ width: 500, height: 800 })

      const viewport = page.viewportSize()
      expect(viewport).not.toBeNull()
      if (!viewport) throw new Error('Viewport size not available')

      await expect(async () => {
        const dialogBox = await viewer.dialog.boundingBox()
        const panelBox = await panel.boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(panelBox).not.toBeNull()
        if (!dialogBox || !panelBox) return

        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.y).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(
          panelBox.x + 1
        )
        expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
          viewport.height + 1
        )
      }).toPass({ timeout: 5000 })
    })

    await test.step('keep both overlays inside the narrow viewport', async () => {
      await page.setViewportSize({ width: 400, height: 800 })
      await expect(panel).toBeVisible()
      await expect(panel).toHaveCSS('position', 'fixed')
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.style.getPropertyValue(
              '--workspace-inset-right'
            )
          )
        )
        .toBe('0px')
      await expect(async () => {
        const dialogBox = await viewer.dialog.boundingBox()
        const panelBox = await panel.boundingBox()
        expect(dialogBox).not.toBeNull()
        expect(panelBox).not.toBeNull()
        if (!dialogBox || !panelBox) return

        expect(dialogBox.width).toBeGreaterThan(0)
        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(401)
        expect(panelBox.width).toBeGreaterThan(0)
        expect(panelBox.x).toBeGreaterThanOrEqual(0)
        expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(401)
      }).toPass({ timeout: 5000 })
    })

    await test.step('restore the viewer and Agent panel controls', async () => {
      await page.setViewportSize({ width: 1280, height: 800 })
      await viewer.cancelButton.click()
      await viewer.waitForClosed()

      const agentPanel = new AgentPanel(page)
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'true'
      )
      await agentPanel.openButton.click()
      await expect(agentPanel.root).toBeHidden()
      await expect(agentPanel.openButton).toHaveAttribute(
        'aria-pressed',
        'false'
      )
      await agentPanel.open()
    })
  })
})
