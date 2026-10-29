import { expect } from '@playwright/test'

import { WORKSPACE_INSET_RIGHT } from '@/composables/useWorkspaceInset'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { load3dAgentTest as test } from '@e2e/fixtures/load3dAgentFixture'
import { Load3DViewerHelper } from '@e2e/tests/load3d/Load3DViewerHelper'

const PIXEL_SLACK = 1

function expectPixels(actual: number, expected: number, label: string): void {
  expect(actual, label).toBeGreaterThanOrEqual(expected - PIXEL_SLACK)
  expect(actual, label).toBeLessThanOrEqual(expected + PIXEL_SLACK)
}

test.describe('Load3D Agent updates', { tag: ['@cloud', '@agent'] }, () => {
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

    const openViewer = async () => {
      await load3dAgent.viewer.openViewerButton.click()
      await viewer.waitForOpen()
      await expect
        .poll(() => viewer.dialog.evaluate((el) => el.getAnimations().length))
        .toBe(0)
    }

    const expectViewerBesidePanel = async (width: number) => {
      await page.setViewportSize({ width, height: 800 })
      await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(width)

      await expect(async () => {
        const dialogBox = await viewer.dialog.boundingBox()
        const panelBox = await panel.boundingBox()
        if (!dialogBox) throw new Error('Load3D viewer is not laid out')
        if (!panelBox) throw new Error('Agent panel is not laid out')

        const publishedInset = await page.evaluate(
          (property) =>
            getComputedStyle(document.documentElement)
              .getPropertyValue(property)
              .trim(),
          WORKSPACE_INSET_RIGHT
        )
        expect(publishedInset).toMatch(/^\d+(\.\d+)?px$/)
        const inset = Number.parseFloat(publishedInset)

        expectPixels(
          panelBox.x + panelBox.width,
          width,
          'the panel is flush with the viewport edge'
        )
        expectPixels(
          inset,
          panelBox.width,
          'the panel publishes its width as the workspace inset'
        )
        expect(dialogBox.width).toBeGreaterThan(0)
        expect(dialogBox.x).toBeGreaterThanOrEqual(0)
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(
          panelBox.x + PIXEL_SLACK
        )
        expectPixels(
          panelBox.x - (dialogBox.x + dialogBox.width),
          dialogBox.x,
          'the viewer is centered in the visible workspace'
        )
      }).toPass({ timeout: 5000 })
    }

    const resizePanelTo = async (width: number) => {
      await viewer.cancelButton.click()
      await viewer.waitForClosed()
      const handleBox = await page
        .getByTestId('agent-panel-resize-handle')
        .boundingBox()
      const panelBox = await panel.boundingBox()
      if (!handleBox)
        throw new Error('Agent panel resize handle is not laid out')
      if (!panelBox) throw new Error('Agent panel is not laid out')

      const x = handleBox.x + handleBox.width / 2
      const y = handleBox.y + handleBox.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + panelBox.width - width, y, { steps: 10 })
      await page.mouse.up()
      await expect
        .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
        .toBe(width)
      await openViewer()
    }

    await test.step('open the viewer from an agent-updated node', async () => {
      load3dAgent.setModelFromAgent('cube.obj')
      await load3dAgent.expectModel('cube.obj')
      await load3dAgent.viewer.waitForModelLoaded()
      await openViewer()
    })

    await test.step('keep the viewer beside the panel on a desktop viewport', () =>
      expectViewerBesidePanel(1280))

    await test.step('keep the viewer beside the panel at the sm breakpoint', () =>
      expectViewerBesidePanel(640))

    await test.step('keep the viewer beside the panel below the sm breakpoint', () =>
      expectViewerBesidePanel(560))

    await test.step('keep the viewer beside the panel on a wide viewport', () =>
      expectViewerBesidePanel(2560))

    await test.step('follow a wider panel without overlapping it', async () => {
      await page.setViewportSize({ width: 1920, height: 800 })
      await resizePanelTo(620)
      await expectViewerBesidePanel(1920)
      await resizePanelTo(420)
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
