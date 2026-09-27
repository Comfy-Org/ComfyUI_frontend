import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { BAD_DO_NOT_DO_THIS_LegacyApiHelper } from '@e2e/fixtures/helpers/BAD_DO_NOT_DO_THIS_LegacyApiHelper'
import { toNodeId } from '@/types/nodeId'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.workflow.loadWorkflow('widgets/image_crop_widget')
  await comfyPage.vueNodes.waitForNodes()
})

test(
  'Programmatically setting widget value updates bounding box inputs',
  { tag: '@ui' },
  async ({ comfyPage }) => {
    const newBounds = { x: 50, y: 100, width: 200, height: 300 }
    const legacyApi = new BAD_DO_NOT_DO_THIS_LegacyApiHelper(comfyPage.page)

    await legacyApi.setImageCropWidgetValue(toNodeId(1), newBounds)
    await comfyPage.nextFrame()

    const node = comfyPage.vueNodes.getNodeLocator('1')
    const inputs = node.locator('input[inputmode="decimal"]')

    await expect.poll(() => inputs.nth(0).inputValue()).toBe('50')
    await expect.poll(() => inputs.nth(1).inputValue()).toBe('100')
    await expect.poll(() => inputs.nth(2).inputValue()).toBe('200')
    await expect.poll(() => inputs.nth(3).inputValue()).toBe('300')
  }
)
