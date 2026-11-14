import { expect } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  ENTRY_URL,
  LOCAL_WEB_ACCESS_TOKEN,
  OWNER_ONLY,
  OWNER_ONLY_MESSAGE,
  WORKSPACE_ID,
  localWebBillingHandoffTest as test
} from '@e2e/fixtures/localWebBillingHandoffFixture'

test.describe('Local web billing handoff', () => {
  test.describe.configure({ timeout: 60_000 })
  test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Top' } })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.toast.closeToasts()
  })

  test.describe('flag off', () => {
    test.use({ localBillingWeb: false })

    test('opens the Add credits dialog without a handoff', async ({
      comfyPage,
      handoffRequests,
      openAddCredits
    }) => {
      await openAddCredits()
      const page = comfyPage.page

      await expect(new TopUpCreditsDialog(page).heading).toBeVisible()
      expect(handoffRequests).toHaveLength(0)
    })

    test('keeps Plan & Credits in Settings', async ({ openSettings }) => {
      const settings = await openSettings()

      await expect(
        settings.category('Plan & Credits', { exact: true })
      ).toBeVisible()
      await expect(settings.category('Billing', { exact: true })).toHaveCount(0)
    })
  })

  test.describe('flag on', () => {
    test.use({ localBillingWeb: true })

    test('Continue opens billing-web at the issued entry URL for the picked amount', async ({
      comfyPage,
      handoffRequests,
      openAddCredits
    }) => {
      const page = comfyPage.page
      const dialog = new TopUpCreditsDialog(page)
      await openAddCredits()
      await dialog.preset25.click()
      expect(handoffRequests).toHaveLength(0)

      const popupOpened = page.waitForEvent('popup')
      await dialog.continueButton.click()
      const popup = await popupOpened

      await expect(popup).toHaveURL(ENTRY_URL)
      await expect(dialog.openedHeading).toBeVisible()
      expect(handoffRequests).toHaveLength(1)
      const [handoff] = handoffRequests
      expect(handoff.method()).toBe('POST')
      expect(await handoff.headerValue('authorization')).toBe(
        `Bearer ${LOCAL_WEB_ACCESS_TOKEN}`
      )
      expect(handoff.postDataJSON()).toEqual(
        expect.objectContaining({
          workspace_id: WORKSPACE_ID,
          receiver: 'billing_web',
          surface: 'local_web',
          intent: 'top-up',
          amount_cents: 2500
        })
      )
    })

    test('shows the Billing tab without Platform links instead of Plan & Credits', async ({
      comfyPage,
      openSettings
    }) => {
      const settings = await openSettings()

      await settings.category('Billing', { exact: true }).click()
      const billingTab = comfyPage.page.getByTestId('billing-tab')
      await expect(billingTab).toBeVisible()
      await expect(billingTab.getByTestId('billing-plan-row')).toBeVisible()
      await expect(billingTab.getByTestId('billing-handoff')).toHaveCount(0)
      await expect(billingTab.locator('a[href*="/profile/"]')).toHaveCount(0)
      await expect(
        billingTab
          .getByTestId('billing-plan-section')
          .getByRole('button', { name: /plan/i })
      ).toHaveCount(0)
      await expect(
        settings.category('Plan & Credits', { exact: true })
      ).toHaveCount(0)
    })

    test.describe('when Cloud refuses the handoff', () => {
      test.use({ handoffReply: OWNER_ONLY })

      test('closes the tab and shows the server message in the dialog', async ({
        comfyPage,
        handoffRequests,
        openAddCredits
      }) => {
        const page = comfyPage.page
        const dialog = new TopUpCreditsDialog(page)
        await openAddCredits()

        const popupOpened = page.waitForEvent('popup')
        await dialog.continueButton.click()
        const popup = await popupOpened

        await expect(dialog.notice).toContainText(OWNER_ONLY_MESSAGE)
        await expect.poll(() => popup.isClosed()).toBe(true)
        expect(handoffRequests).toHaveLength(1)
        await expect(dialog.continueButton).toBeEnabled()
      })
    })
  })
})
