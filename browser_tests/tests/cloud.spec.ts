import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { TestIds } from '../fixtures/selectors'

test.describe('Cloud distribution UI', { tag: '@cloud' }, () => {
  // Precondition: cloud test environment must have a free-tier user authenticated.
  // The subscribe button only renders when isCloud && isFreeTier.
  test('subscribe button is attached in cloud mode', async ({ comfyPage }) => {
    const subscribeButton = comfyPage.page.getByTestId(
      TestIds.topbar.subscribeButton
    )
    await expect(subscribeButton).toBeAttached()
  })

  test('bottom panel toggle is hidden in cloud mode', async ({ comfyPage }) => {
    const sideToolbar = comfyPage.page.getByTestId(TestIds.sidebar.toolbar)
    await expect(sideToolbar).toBeVisible()

    // In cloud mode, the bottom panel toggle button should not be rendered
    const bottomPanelToggle = sideToolbar.getByRole('button', {
      name: /bottom panel|terminal/i
    })
    await expect(bottomPanelToggle).toHaveCount(0)
  })
})
