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

for (const { renderer, tags } of [
  { renderer: 'classic', tags: ['@canvas'] },
  { renderer: 'Vue', tags: ['@vue-nodes', '@canvas'] }
]) {
  test.describe(`Workflow image export: ${renderer}`, { tag: tags }, () => {
    test.use({
      viewport: { width: 1920, height: 1080 },
      initialSettings: { 'Comfy.Minimap.Visible': false }
    })

    test('exported image matches the rendered canvas', async ({
      comfyPage
    }, testInfo) => {
      await comfyPage.workflow.loadWorkflow('default')
      const navigation = await comfyPage.canvasOps.snapshotNavigation()

      const exported =
        await test.step('export the workflow image', async () => {
          const download = comfyPage.page.waitForEvent('download')
          await comfyPage.menu.topbar.exportWorkflowImage('workflow_image')
          const file = await download
          expect(file.suggestedFilename()).toBe('workflow_image.png')
          return readFile(await file.path())
        })

      await expect
        .poll(() => comfyPage.canvasOps.snapshotNavigation())
        .toEqual(navigation)

      await test.step('pixels match the canvas at the same view', async () => {
        await comfyPage.setFocusMode(true)
        const clip = await alignCanvasWithExport(comfyPage, exported)
        const live = await comfyPage.page.screenshot({ clip })
        await testInfo.attach('exported-workflow.png', {
          body: exported,
          contentType: 'image/png'
        })
        await expectPngsToMatch(testInfo, 'workflow-image', exported, live)
      })
    })
  })
}

test.describe(
  'Workflow image export failures',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.use({ initialSettings: { 'Comfy.PromptFilename': false } })

    test('refuses an undecodable node instead of downloading a partial graph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.page
        .getByRole('textbox', { name: 'text', exact: true })
        .first()
        .fill('invalid XML: \u0001')
      const downloads: string[] = []
      comfyPage.page.on('download', (download) =>
        downloads.push(download.suggestedFilename())
      )

      await comfyPage.command.executeCommand('Comfy.ExportWorkflowImage')

      await expect(
        comfyPage.toast.withText('Failed to export workflow image')
      ).toBeVisible()
      expect(downloads).toEqual([])
    })

    test('refuses a graph cleared by a drawing callback', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const downloads: string[] = []
      comfyPage.page.on('download', (download) =>
        downloads.push(download.suggestedFilename())
      )

      await comfyPage.page.evaluate(() => {
        const app = window.app!
        app.canvas.onRenderBackground = () => {
          app.canvas.graph = null
          return false
        }
        return app.extensionManager.command.execute('Comfy.ExportWorkflowImage')
      })

      await expect(
        comfyPage.toast.withText('Failed to export workflow image')
      ).toBeVisible()
      expect(downloads).toEqual([])
    })

    test('exports when a readable stylesheet imports inaccessible CSS', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      const url = 'https://workflow-export.invalid/import.css'
      await comfyPage.page.route(url, (route) =>
        route.fulfill({
          contentType: 'text/css',
          body: 'body { --export-test: 1; }'
        })
      )
      await comfyPage.page.addStyleTag({ content: `@import url("${url}");` })
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const sheets = [...document.styleSheets]
            const imported = sheets
              .flatMap((sheet) => [...sheet.cssRules])
              .find((rule) => rule instanceof CSSImportRule)
            if (!(imported instanceof CSSImportRule) || !imported.styleSheet)
              return false
            try {
              void imported.styleSheet.cssRules
              return false
            } catch (error) {
              return (
                error instanceof DOMException && error.name === 'SecurityError'
              )
            }
          })
        )
        .toBe(true)

      const downloading = comfyPage.page.waitForEvent('download')
      await comfyPage.command.executeCommand('Comfy.ExportWorkflowImage')

      const download = await downloading
      const png = await readFile(await download.path())
      expect(download.suggestedFilename()).toBe('default.png')
      expect(png.subarray(1, 4).toString()).toBe('PNG')
      await expect(
        comfyPage.toast.withText('Failed to export workflow image')
      ).toBeHidden()
    })
  }
)
