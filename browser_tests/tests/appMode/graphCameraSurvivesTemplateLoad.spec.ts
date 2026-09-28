import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  APP_MODE_TEMPLATE,
  mockAppModeTemplate
} from '@e2e/fixtures/helpers/TemplateHelper'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'

const test = mergeTests(comfyPageFixture, templateApiFixture)

/**
 * PM-1732 / PM-1733 — App Mode keeps the graph canvas mounted but hidden, so
 * its element measures 0x0. Loading a template from there fit the view against
 * that zero-size element, computing 0/0 and leaving the camera at scale 0 with
 * NaN offsets. Returning to the graph then showed a canvas that rendered
 * nothing and could not be recovered by panning, zooming or Fit View, with
 * every node still in the graph.
 */
test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ templateApi }) => {
    await mockAppModeTemplate(templateApi)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('leaves the graph camera usable when returning from app mode', async ({
    comfyPage,
    templateApi
  }) => {
    const { appMode, canvasOps } = comfyPage

    await test.step('app mode hides the canvas', async () => {
      await appMode.enterAppModeWithInputs([['3', 'seed']])
      await expect(appMode.centerPanel).toBeVisible()
      await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
    })

    await test.step('the template loads while the canvas is hidden', async () => {
      await templateApi.load(APP_MODE_TEMPLATE)
      await expect
        .poll(() => appMode.getActiveWorkflowName())
        .toContain(APP_MODE_TEMPLATE)
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect.poll(() => appMode.getViewMode()).toBe('app')
      await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
    })

    await test.step('returning to the graph leaves a usable camera', async () => {
      await appMode.toggleAppMode()
      await expect.poll(() => appMode.getViewMode()).toBe('graph')
      await expect.poll(() => canvasOps.getElementWidth()).toBeGreaterThan(0)

      const { scale, offset, nodeCount } = await canvasOps.getFraming()
      expect(nodeCount, 'the template is still in the graph').toBeGreaterThan(0)
      expect(scale, 'camera scale stays usable').toBeGreaterThan(0)
      expect(
        offset.every(Number.isFinite),
        `camera offset stays finite, got ${JSON.stringify(offset)}`
      ).toBe(true)
    })
  })
})
