import { mergeTests } from '@playwright/test'

import appTemplate from '@e2e/assets/linear-basic-app-1.json' with { type: 'json' }
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ templateApi }) => {
    const workflow = zComfyWorkflow.parse(structuredClone(appTemplate))
    workflow.extra = { ...workflow.extra, linearMode: true }
    templateApi.configure(
      withTemplates([
        makeTemplate({
          name: 'pm-1733-app-template',
          title: 'App Template'
        })
      ])
    )
    await templateApi.mock()
    await templateApi.mockWorkflowData('pm-1733-app-template', workflow)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('frames the real template-browser load after returning to graph mode', async ({
    comfyPage,
    templateApi
  }) => {
    const page = comfyPage.page

    await test.step('load the template while the canvas is hidden', async () => {
      await comfyPage.appMode.enterAppModeWithInputs([['3', 'seed']])
      await expect
        .poll(() => page.evaluate(() => window.app!.canvasEl.width))
        .toBe(0)
      await page.evaluate(() => {
        const { ds } = window.app!.canvas
        ds.offset[0] = -60_000
        ds.offset[1] = -60_000
        ds.scale = 0.05
      })

      await templateApi.load('pm-1733-app-template')
      await expect
        .poll(() => comfyPage.workflow.getActiveWorkflowPath())
        .toContain('pm-1733-app-template')
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(async () => {
          return (
            (await comfyPage.workflow.getActiveWorkflowActiveAppMode()) ??
            (await comfyPage.workflow.getActiveWorkflowInitialMode()) ??
            'graph'
          )
        })
        .toBe('app')
      await expect
        .poll(() => page.evaluate(() => window.app!.canvasEl.width))
        .toBe(0)
    })

    await test.step('return to graph mode with the template framed', async () => {
      await comfyPage.appMode.toggleAppMode()
      await expect
        .poll(() => page.evaluate(() => window.app!.canvasEl.width))
        .toBeGreaterThan(0)
      await expect
        .poll(() =>
          page.evaluate(() => {
            const app = window.app!
            app.canvas.ds.computeVisibleArea(app.canvas.viewport)
            const [vx, vy, vw, vh] = app.canvas.ds.visible_area
            return app.rootGraph.nodes.filter((node) => {
              const [x, y, w, h] = node.boundingRect
              return x < vx + vw && vx < x + w && y < vy + vh && vy < y + h
            }).length
          })
        )
        .toBeGreaterThan(0)

      const scale = await comfyPage.canvasOps.getScale()
      const offset = await comfyPage.canvasOps.getOffset()
      expect(scale).toBeGreaterThan(0)
      expect(offset.every(Number.isFinite)).toBe(true)
    })
  })
})
