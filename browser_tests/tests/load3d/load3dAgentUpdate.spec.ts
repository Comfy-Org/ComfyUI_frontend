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

  test('keeps the full-screen viewer inside the visible workspace inset', async ({
    load3dAgent,
    page
  }) => {
    load3dAgent.setModelFromAgent('cube.obj')
    await load3dAgent.expectModel('cube.obj')
    await load3dAgent.viewer.waitForModelLoaded()

    const viewer = new Load3DViewerHelper(page)
    await page.evaluate(() => {
      const app = window.app!
      const node = app.graph.nodes.find(
        (candidate) => String(candidate.id) === '1'
      )
      if (!node) throw new Error('Expected Load3D node 1')
      app.canvas.selectNode(node)
    })
    await page
      .getByRole('button', {
        name: 'Open 3D Viewer (Beta) for Selected Node',
        exact: true
      })
      .click()
    await viewer.waitForOpen()
    await page.setViewportSize({ width: 500, height: 800 })

    const viewport = page.viewportSize()
    expect(viewport).not.toBeNull()
    if (!viewport) throw new Error('Viewport size not available')

    await expect(async () => {
      const dialogBox = await viewer.dialog.boundingBox()
      const panelBox = await page
        .getByTestId('docked-agent-panel')
        .boundingBox()
      expect(dialogBox).not.toBeNull()
      expect(panelBox).not.toBeNull()
      if (!dialogBox || !panelBox) return

      expect(dialogBox.x).toBeGreaterThanOrEqual(0)
      expect(dialogBox.y).toBeGreaterThanOrEqual(0)
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(panelBox.x + 1)
      expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(
        viewport.height + 1
      )
    }).toPass({ timeout: 5000 })

    await page.setViewportSize({ width: 400, height: 800 })
    const panel = page.getByTestId('docked-agent-panel')
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

    await viewer.cancelButton.click()
    await viewer.waitForClosed()

    const agentPanel = new AgentPanel(page)
    await expect(agentPanel.openButton).toHaveAttribute('aria-pressed', 'true')
    await agentPanel.openButton.click()
    await expect(agentPanel.root).toBeHidden()
    await expect(agentPanel.openButton).toHaveAttribute('aria-pressed', 'false')
    await agentPanel.open()
  })
})
