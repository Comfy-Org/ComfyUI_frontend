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
 * PM-1732 / PM-1733 — App Mode hides the graph canvas, so its element measures
 * 0x0 and fitting the view against it produced scale 0 with NaN offsets.
 *
 * Scope: this checks the camera is still valid after returning to the graph,
 * not that the graph is automatically re-framed. The hidden-canvas fit is a
 * no-op, so the camera keeps the viewport it had on entry.
 */
test.describe('App mode template load', { tag: ['@canvas'] }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.beforeEach(async ({ templateApi }) => {
    await mockAppModeTemplate(templateApi)
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('preserves the graph camera when returning from app mode', async ({
    comfyPage,
    templateApi
  }) => {
    const { appMode, canvasOps, workflow } = comfyPage

    const cameraOnEntry =
      await test.step('app mode hides the canvas', async () => {
        await appMode.enterAppModeWithInputs([['3', 'seed']])
        await expect(appMode.centerPanel).toBeVisible()
        await expect.poll(() => canvasOps.getElementWidth()).toBe(0)
        return {
          scale: await canvasOps.getScale(),
          offset: await canvasOps.getOffset()
        }
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

    await test.step('returning to the graph keeps that camera', async () => {
      await appMode.toggleAppMode()
      await expect
        .poll(() => workflow.getActiveWorkflowResolvedMode())
        .toBe('graph')
      await expect.poll(() => canvasOps.getElementWidth()).toBeGreaterThan(0)

      expect(await canvasOps.getScale(), 'camera scale is unchanged').toBe(
        cameraOnEntry.scale
      )
      expect(await canvasOps.getOffset(), 'camera offset is unchanged').toEqual(
        cameraOnEntry.offset
      )
    })
  })
})
