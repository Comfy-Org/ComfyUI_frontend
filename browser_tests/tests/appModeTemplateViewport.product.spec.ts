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
  test('frames a template after the hidden canvas becomes visible', async ({
    comfyPage,
    templateApi
  }) => {
    const { appMode, canvasOps, workflow } = comfyPage
    await mockAppModeTemplate(templateApi)

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

    await test.step('show the canvas and apply the queued camera', async () => {
      await appMode.toggleAppMode()
      await expect.poll(() => canvasOps.getElementWidth()).toBeGreaterThan(0)
      await canvasOps.waitForViewToSettle()

      expect(await canvasOps.getVisibleNodeCount()).toBe(7)
    })
  })
})
