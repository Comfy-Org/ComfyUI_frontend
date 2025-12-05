import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel', () => {
  test('complex test', async ({ page, comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()

    await expect(page.getByText('No node(s) selected')).toBeVisible()

    await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

    await expect(page.getByText('3 nodes selected')).toBeVisible()

    await expect(page.getByText('KSampler')).toHaveCount(1) // Will be 2 in Vue mode
  })
})
