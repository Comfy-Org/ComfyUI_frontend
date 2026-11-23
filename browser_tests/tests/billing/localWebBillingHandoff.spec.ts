import { expect } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  ENTRY_URL,
  LOCAL_WEB_ACCESS_TOKEN,
  OWNER_ONLY,
  OWNER_ONLY_MESSAGE,
  WORKSPACE_ID,
  localWebBillingHandoffTest as test,
  taggedEntryUrl
} from '@e2e/fixtures/localWebBillingHandoffFixture'
import { TestIds } from '@e2e/fixtures/selectors'

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

    test.describe('with auto top-up at checkout served to the local account', () => {
      test.use({ autoTopUpOffered: true, cloudAutoTopUpAtCheckout: true })

      test('Continue carries the ticked auto top-up to billing-web through the handoff', async ({
        comfyPage,
        handoffRequests,
        openAddCredits
      }) => {
        const page = comfyPage.page
        const dialog = new TopUpCreditsDialog(page)
        await openAddCredits()
        await dialog.preset50.click()
        await dialog.autoTopUpCheckbox.check()

        const popupOpened = page.waitForEvent('popup')
        await dialog.continueButton.click()
        await expect(await popupOpened).toHaveURL(ENTRY_URL)

        expect(handoffRequests).toHaveLength(1)
        expect(handoffRequests[0].postDataJSON()).toEqual(
          expect.objectContaining({
            receiver: 'billing_web',
            intent: 'top-up',
            amount_cents: 5000,
            auto_top_up: {
              threshold_credits: 1000,
              target_credits: 11_550,
              monthly_budget_cents: null
            }
          })
        )
      })
    })

    test('shows the Billing tab with no plain Platform link instead of Plan & Credits', async ({
      comfyPage,
      openSettings
    }) => {
      const settings = await openSettings()

      await settings.category('Billing', { exact: true }).click()
      const billingTab = comfyPage.page.getByTestId('billing-tab')
      await expect(billingTab).toBeVisible()
      await expect(billingTab.getByTestId('billing-plan-row')).toBeVisible()
      await expect(billingTab.locator('a[href*="/profile/"]')).toHaveCount(0)
      await expect(
        settings.category('Plan & Credits', { exact: true })
      ).toHaveCount(0)
    })

    test('the plan action opens Platform Plans at the issued entry URL', async ({
      comfyPage,
      handoffRequests,
      openSettings
    }) => {
      const page = comfyPage.page
      const settings = await openSettings()
      await settings.category('Billing', { exact: true }).click()
      const planAction = page
        .getByTestId('billing-plan-row')
        .getByRole('button', { name: /^(Subscribe|Choose a plan|Manage)$/ })
      await expect(planAction).toBeVisible()

      const popupOpened = page.waitForEvent('popup')
      await planAction.click()
      const popup = await popupOpened

      await expect(popup).toHaveURL(taggedEntryUrl('plans'))
      expect(handoffRequests).toHaveLength(1)
      const body = handoffRequests[0].postDataJSON()
      expect(body).toEqual(
        expect.objectContaining({
          workspace_id: WORKSPACE_ID,
          receiver: 'platform',
          surface: 'local_web'
        })
      )
      expect(body).not.toHaveProperty('intent')
    })

    test.describe('with auto top-up offered', () => {
      test.use({ autoTopUpOffered: true })

      test('Turn on opens Platform billing at the issued entry URL', async ({
        comfyPage,
        handoffRequests,
        openSettings
      }) => {
        const page = comfyPage.page
        const settings = await openSettings()
        await settings.category('Billing', { exact: true }).click()
        const turnOn = page
          .getByTestId('billing-auto-top-up-card')
          .getByRole('button', { name: 'Turn on' })
        await expect(turnOn).toBeVisible()
        await expect(
          page.getByTestId('billing-tab').locator('a[href*="/profile/"]')
        ).toHaveCount(0)

        const popupOpened = page.waitForEvent('popup')
        await turnOn.click()
        const popup = await popupOpened

        await expect(popup).toHaveURL(taggedEntryUrl())
        expect(handoffRequests).toHaveLength(1)
        const body = handoffRequests[0].postDataJSON()
        expect(body).toEqual(
          expect.objectContaining({
            workspace_id: WORKSPACE_ID,
            receiver: 'platform',
            surface: 'local_web'
          })
        )
        expect(body).not.toHaveProperty('intent')
        expect(body).not.toHaveProperty('amount_cents')
      })

      test.describe('when Cloud refuses the handoff', () => {
        test.use({ handoffReply: OWNER_ONLY })

        test('closes the tab and shows the server message', async ({
          comfyPage,
          openSettings
        }) => {
          const page = comfyPage.page
          const settings = await openSettings()
          await settings.category('Billing', { exact: true }).click()

          const popupOpened = page.waitForEvent('popup')
          await page
            .getByTestId('billing-auto-top-up-card')
            .getByRole('button', { name: 'Turn on' })
            .click()
          const popup = await popupOpened

          await expect(
            page.getByTestId('toast').getByText(OWNER_ONLY_MESSAGE)
          ).toBeVisible()
          await expect.poll(() => popup.isClosed()).toBe(true)
        })
      })
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

  test.describe('new billing UX read from Cloud', () => {
    test.use({ billingNewUx: false, localBillingWeb: true })

    test.describe('when Cloud serves billing_new_ux_enabled on', () => {
      test.use({ cloudBillingNewUx: true })

      test('shows the new Billing tab and the new profile menu', async ({
        comfyPage,
        openAddCredits,
        openSettings
      }) => {
        const page = comfyPage.page

        await test.step('Settings shows the Billing tab without the 1.60 release marker', async () => {
          const settings = await openSettings()
          await settings.category('Billing', { exact: true }).click()
          const billingTab = page.getByTestId('billing-tab')
          await expect(billingTab.getByTestId('billing-plan-row')).toBeVisible()
          await expect(billingTab).not.toHaveAttribute('data-billing-release')
          await settings.close()
        })

        await test.step('the profile menu Credits row opens a flyout that offers Add credits', async () => {
          await openAddCredits()
          await expect(new TopUpCreditsDialog(page).heading).toBeVisible()
        })
      })
    })

    test.describe('when Cloud serves billing_new_ux_enabled off', () => {
      test.use({ cloudBillingNewUx: false })

      test('keeps the 1.60 Billing tab and the earlier profile menu', async ({
        comfyPage,
        openSettings
      }) => {
        const page = comfyPage.page

        await test.step('Settings shows the Billing tab with the 1.60 release marker', async () => {
          const settings = await openSettings()
          await settings.category('Billing', { exact: true }).click()
          await expect(page.getByTestId('billing-tab')).toHaveAttribute(
            'data-billing-release',
            '1.60'
          )
          await settings.close()
        })

        await test.step('the profile menu offers Add credits directly and has no Credits row', async () => {
          await page.getByRole('button', { name: 'Current user' }).click()
          const menu = page.getByTestId(TestIds.user.currentUserPopover)
          await expect(
            menu.getByRole('button', { name: 'Add credits' })
          ).toBeVisible()
          await expect(
            menu.getByRole('button', { name: /^Credits/ })
          ).toHaveCount(0)
        })
      })
    })
  })
})
