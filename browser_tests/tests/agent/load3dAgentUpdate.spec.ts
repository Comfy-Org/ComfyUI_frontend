import { expect } from '@playwright/test'

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

  test('centers the full-screen viewer on the viewport regardless of the Agent panel', async ({
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

    const expectViewportCenteredViewer = async (width: number) => {
      await page.setViewportSize({ width, height: 800 })

      await expect(async () => {
        const dialogBox = await viewer.dialog.boundingBox()
        if (!dialogBox) throw new Error('Load3D viewer is not laid out')
        expectPixels(dialogBox.width, width * 0.9, 'viewport-relative width')
        expectPixels(dialogBox.height, 720, 'viewport-relative height')
        expectPixels(dialogBox.x, width * 0.05, 'horizontally centered')
        expectPixels(dialogBox.y, 40, 'vertically centered')
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

    for (const width of [1280, 640, 560, 2560, 500, 400]) {
      await test.step(`center the viewer at ${width}px`, async () => {
        await expectViewportCenteredViewer(width)
        await expect(panel).toBeVisible()
      })
    }

    await test.step('keep the viewer size and center after resizing the panel', async () => {
      await page.setViewportSize({ width: 1920, height: 800 })
      await resizePanelTo(620)
      await expectViewportCenteredViewer(1920)
      await resizePanelTo(420)
      await expectViewportCenteredViewer(1920)
    })
  })
})
