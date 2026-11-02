import { readFile } from 'node:fs/promises'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { expectPngsToMatch } from '@e2e/fixtures/utils/pngComparison'

async function alignCanvasWithExport(comfyPage: ComfyPage, exported: Buffer) {
  const { page } = comfyPage
  const pixelRatio = await page.evaluate(() => window.devicePixelRatio)
  const width = exported.readUInt32BE(16) / pixelRatio
  const height = exported.readUInt32BE(20) / pixelRatio

  const contentBounds = await page.evaluate(() => {
    const { graph } = window.app!.canvas
    const bounds = [Infinity, Infinity, -Infinity, -Infinity]
    for (const item of graph!.positionableItems()) {
      const [x, y, w, h] = item.boundingRect
      bounds[0] = Math.min(bounds[0], x)
      bounds[1] = Math.min(bounds[1], y)
      bounds[2] = Math.max(bounds[2], x + w)
      bounds[3] = Math.max(bounds[3], y + h)
    }
    return bounds
  })
  const padding = (width - (contentBounds[2] - contentBounds[0])) / 2

  await comfyPage.canvasOps.setScale(1)
  await comfyPage.canvasOps.setOffset([
    padding - contentBounds[0],
    padding - contentBounds[1]
  ])
  await comfyPage.canvasOps.moveMouseToEmptyArea()
  await comfyPage.canvasOps.waitForViewToSettle()

  const canvasBox = await comfyPage.canvas.boundingBox()
  if (!canvasBox) throw new Error('Canvas is not visible')
  return { x: canvasBox.x, y: canvasBox.y, width, height }
}

test.describe(
  'Workflow image export',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.use({
      viewport: { width: 1920, height: 1080 },
      initialSettings: { 'Comfy.Minimap.Visible': false }
    })

    test('exported image matches the rendered canvas', async ({
      comfyPage
    }, testInfo) => {
      await comfyPage.workflow.loadWorkflow('default')

      const exported =
        await test.step('export the workflow image', async () => {
          const download = comfyPage.page.waitForEvent('download')
          await comfyPage.menu.topbar.exportWorkflowImage('workflow_image')
          const file = await download
          expect(file.suggestedFilename()).toBe('workflow_image.png')
          return readFile(await file.path())
        })

      await test.step('pixels match the canvas at the same view', async () => {
        await comfyPage.setFocusMode(true)
        const clip = await alignCanvasWithExport(comfyPage, exported)
        const live = await comfyPage.page.screenshot({ clip })
        await expectPngsToMatch(testInfo, 'workflow-image', exported, live)
      })
    })
  }
)
