import { expect } from '@playwright/test'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { load3dAgentTest as test } from '@e2e/fixtures/load3dAgentFixture'
import { Load3DViewerHelper } from '@e2e/tests/load3d/Load3DViewerHelper'

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

  test('keeps the full-screen viewer centered in the viewport', async ({
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

    await test.step('keep the viewer centered over the docked Agent panel', async () => {
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

        expect(dialogBox.x).toBeCloseTo(
          (viewport.width - dialogBox.width) / 2,
          1
        )
        expect(dialogBox.y).toBeCloseTo(
          (viewport.height - dialogBox.height) / 2,
          1
        )
        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(
          viewport.width + 1
        )
        expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
          viewport.height + 1
        )
        expect(panelBox.x).toBeGreaterThan(dialogBox.x)
        expect(panelBox.x + panelBox.width).toBeCloseTo(viewport.width, 1)
        expect(dialogBox.x + dialogBox.width).toBeGreaterThan(panelBox.x)

        const point = {
          x: (panelBox.x + dialogBox.x + dialogBox.width) / 2,
          y: dialogBox.y + dialogBox.height / 2
        }
        const dialogIsTopmost = await viewer.dialog.evaluate(
          (element, point) =>
            element.contains(document.elementFromPoint(point.x, point.y)),
          point
        )
        expect(dialogIsTopmost).toBe(true)
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
