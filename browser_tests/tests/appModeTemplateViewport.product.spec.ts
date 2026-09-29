import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { templateApiFixture } from '@e2e/fixtures/templateApiFixture'
import {
  APP_MODE_TEMPLATE,
  mockAppModeTemplate
} from '@e2e/fixtures/utils/appModeTemplate'

const test = mergeTests(comfyPageFixture, templateApiFixture)

test.describe('App mode template viewport', { tag: ['@canvas'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ templateApi }) => {
    await mockAppModeTemplate(templateApi)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('frames a template after the hidden canvas becomes visible', async ({
    comfyPage,
    templateApi
  }) => {
    const { appMode, canvasOps, workflow } = comfyPage

    await test.step('hide the canvas in app mode', async () => {
      await appMode.enterAppModeWithInputs([['3', 'seed']])
      await expect(appMode.centerPanel).toBeVisible()
      await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
    })

    await test.step('load the template through the template browser path', async () => {
      await templateApi.load(APP_MODE_TEMPLATE)
      await expect
        .poll(() => workflow.getActiveWorkflowPath())
        .toContain(APP_MODE_TEMPLATE)
      await workflow.waitForWorkflowIdle()
      await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
    })

    await test.step('show the canvas and flush the scheduled frame', async () => {
      await appMode.toggleAppMode()
      await expect.poll(() => canvasOps.getElementWidth()).toBeGreaterThan(0)
      await canvasOps.waitForViewToSettle()

      const scale = await canvasOps.getScale()
      const offset = await canvasOps.getOffset()
      expect(scale).toBeGreaterThan(0)
      expect(Number.isFinite(scale)).toBe(true)
      expect(offset.every(Number.isFinite)).toBe(true)
      expect(await canvasOps.getVisibleNodeCount()).toBe(7)
    })
  })
})
