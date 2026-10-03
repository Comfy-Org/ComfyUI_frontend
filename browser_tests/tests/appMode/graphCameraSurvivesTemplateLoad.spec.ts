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

/**
 * PM-1732 / PM-1733 — App Mode hides the graph canvas, so camera work must wait
 * until the lifecycle has restored a measurable viewport. The current viewport
 * architecture then applies the queued template framing operation.
 */
test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ templateApi }) => {
    await mockAppModeTemplate(templateApi)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('applies a valid queued camera when returning from app mode', async ({
    comfyPage,
    templateApi
  }) => {
    const { appMode, canvasOps, workflow } = comfyPage

    const cameraOnEntry =
      await test.step('app mode hides the canvas', async () => {
        await appMode.enterAppModeWithInputs([['3', 'seed']])
        await expect(appMode.centerPanel).toBeVisible()
        await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
        const camera = await canvasOps.getCamera()
        expect(Number.isFinite(camera.scale)).toBe(true)
        expect(camera.offset.every(Number.isFinite)).toBe(true)
        return camera
      })

    await test.step('the template loads while the canvas is hidden', async () => {
      await templateApi.load(APP_MODE_TEMPLATE)
      await expect
        .poll(() => workflow.getActiveWorkflowPath())
        .toContain(APP_MODE_TEMPLATE)
      await workflow.waitForWorkflowIdle()
      await expect
        .poll(() => workflow.getActiveWorkflowResolvedMode())
        .toBe('app')
      await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
    })

    await test.step('returning to the graph applies the queued camera', async () => {
      await appMode.toggleAppMode()
      await expect
        .poll(() => workflow.getActiveWorkflowResolvedMode())
        .toBe('graph')
      await expect
        .poll(async () => {
          const { width, height } = await canvasOps.getElementSize()
          return width > 0 && height > 0
        })
        .toBe(true)
      await canvasOps.waitForViewToSettle()

      const cameraOnExit = await canvasOps.getCamera()
      expect(
        Number.isFinite(cameraOnExit.scale),
        'camera scale is finite'
      ).toBe(true)
      expect(cameraOnExit.offset.every(Number.isFinite)).toBe(true)
      expect(
        cameraOnExit,
        'template framing replaces the entry camera'
      ).not.toEqual(cameraOnEntry)
      expect(await canvasOps.getVisibleNodeCount()).toBe(7)
    })
  })
})
