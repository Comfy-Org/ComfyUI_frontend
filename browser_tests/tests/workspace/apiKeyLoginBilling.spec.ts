import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'
import {
  API_KEY_BALANCE_DISPLAY,
  API_KEY_WORKSPACE,
  apiKeyAuthFixture as test
} from '@e2e/fixtures/apiKeyAuthFixture'

/**
 * Regression coverage for the 1.51 QA API-key login findings: an API-key
 * session never established workspace context, so every billing surface fell
 * back to the legacy user-scoped /customers/* rail — empty workspace name,
 * zero balance, another workspace's activity, and top-ups the backend
 * rejects. The session must read workspace name, balance, and activity from
 * the key's server-resolved workspace via /api/workspaces/current and
 * /api/billing/*.
 */
test.describe('API-key login billing surfaces', () => {
  test('shows the key workspace context, balance, and activity from the workspace rail', async ({
    comfyPage,
    legacyBillingReads
  }) => {
    const page = comfyPage.page

    await page.getByTestId(TestIds.user.currentUserButton).click()
    const popover = page.getByTestId(TestIds.user.currentUserPopover)
    await expect(popover).toBeVisible()

    const workspaceRow = popover.getByTestId('workspace-context-row')
    await expect(workspaceRow).toContainText(API_KEY_WORKSPACE.name)
    await expect(popover.getByTestId('workspace-switcher-trigger')).toHaveCount(
      0
    )
    await expect(popover).toContainText(API_KEY_BALANCE_DISPLAY)

    await popover.getByTestId('plans-credits-menu-item').click()

    const settingsDialog = comfyPage.settingDialog
    await settingsDialog.waitForVisible()
    await expect(
      settingsDialog.contentArea.getByRole('heading', {
        name: API_KEY_WORKSPACE.name
      })
    ).toBeVisible()
    await expect(settingsDialog.contentArea).toContainText(
      API_KEY_BALANCE_DISPLAY
    )

    await settingsDialog.contentArea
      .getByRole('button', { name: 'Activity' })
      .click()
    await expect(settingsDialog.contentArea).toContainText('Credits Added')

    expect(legacyBillingReads).toEqual([])
  })
})
