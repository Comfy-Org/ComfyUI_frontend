import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Properties panel', () => {
  test('opens and updates title based on selection', async ({ comfyPage }) => {
    await comfyPage.actionbar.propertiesButton.click()

    const { propertiesPanel } = comfyPage.menu

    await expect(propertiesPanel.getByText('No node(s) selected')).toBeVisible()

    await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

    await expect(propertiesPanel.getByText('3 nodes selected')).toBeVisible()

    await expect(propertiesPanel.getByText('KSampler')).toHaveCount(1) // Will be 2 in Vue mode
  })
})
