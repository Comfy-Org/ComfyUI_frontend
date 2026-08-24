import { expect } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { TestIds } from '@e2e/fixtures/selectors'
import { workspaceRailAuthFixture as test } from '@e2e/fixtures/workspaceRailAuthFixture'

/**
 * Regression coverage for 1.51 QA finding #11: on a local (non-Cloud)
 * distribution, a workspace without an active subscription had no way to add
 * credits — the subscribe CTA is hidden on Local and both Add credits entry
 * points were gated on an active subscription. Only reproduces on the
 * workspace billing rail; localCreditsNoSubscribeUi.spec.ts covers the
 * legacy rail.
 */
test.describe('Local credits surfaces on the workspace billing rail', () => {
  test('lets an unsubscribed workspace owner reach the top-up dialog', async ({
    comfyPage
  }) => {
    const page = comfyPage.page
    const topUpDialog = new TopUpCreditsDialog(page)

    await page.getByTestId(TestIds.user.currentUserButton).click()
    const popover = page.getByTestId(TestIds.user.currentUserPopover)
    await expect(popover).toBeVisible()
    await expect(popover.getByTestId('add-credits-button')).toBeVisible()
    await expect(
      popover.getByTestId('upgrade-to-add-credits-button')
    ).toHaveCount(0)
    await expect(
      popover.getByRole('button', { name: 'Subscribe', exact: true })
    ).toHaveCount(0)

    await popover.getByTestId('add-credits-button').click()
    await expect(topUpDialog.heading).toBeVisible()
    await topUpDialog.close()

    await page.getByTestId(TestIds.user.currentUserButton).click()
    await page
      .getByTestId(TestIds.user.currentUserPopover)
      .getByTestId('plans-credits-menu-item')
      .click()

    const settingsDialog = comfyPage.settingDialog
    await settingsDialog.waitForVisible()
    const settingsAddCredits = settingsDialog.contentArea.getByRole('button', {
      name: 'Add credits'
    })
    await expect(settingsAddCredits).toBeVisible()
    await expect(
      settingsDialog.contentArea.getByText('Upgrade to add credits')
    ).toHaveCount(0)
    await settingsAddCredits.click()
    await expect(topUpDialog.heading).toBeVisible()
  })
})
