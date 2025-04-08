import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Graph', () => {
  // Should be able to fix link input slot index after swap the input order
  // Ref: https://github.com/Comfy-Org/ComfyUI_frontend/issues/3348
  test('Fix link input slots', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('input_order_swap')
    expect(
      await comfyPage.page.evaluate(() => {
        return window['app'].graph.links.get(1)?.target_slot
      })
    ).toBe(1)
  })

  test('Validate workflow links', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('bad_link')
    await expect(comfyPage.getVisibleToastCount()).resolves.toBe(2)
  })
})
