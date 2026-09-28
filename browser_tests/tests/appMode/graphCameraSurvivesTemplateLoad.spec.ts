import { mergeTests } from '@playwright/test'

import appTemplate from '@e2e/assets/linear-basic-app-1.json' with { type: 'json' }
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { makeTemplate } from '@e2e/fixtures/data/templateFixtures'
import { withTemplates } from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)
const TEMPLATE = 'pm-1733-app-template'

test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ templateApi }) => {
    const workflow = structuredClone(
      appTemplate
    ) as unknown as ComfyWorkflowJSON
    workflow.extra = { ...workflow.extra, linearMode: true }
    templateApi.configure(
      withTemplates([makeTemplate({ name: TEMPLATE, title: 'App Template' })])
    )
    await templateApi.mock()
    await templateApi.mockWorkflowData(TEMPLATE, workflow)
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

      await templateApi.load(TEMPLATE)
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              window.app!.extensionManager.workflow.activeWorkflow?.filename ??
              ''
          )
        )
        .toContain(TEMPLATE)
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect
        .poll(() =>
          page.evaluate(() => {
            const workflow =
              window.app!.extensionManager.workflow.activeWorkflow
            return workflow?.activeMode ?? workflow?.initialMode ?? 'graph'
          })
        )
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

      const camera = await page.evaluate(() => ({
        scale: window.app!.canvas.ds.scale,
        offset: [...window.app!.canvas.ds.offset]
      }))
      expect(camera.scale).toBeGreaterThan(0)
      expect(camera.offset.every(Number.isFinite)).toBe(true)
    })
  })
})
