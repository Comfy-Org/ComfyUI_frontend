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
import type { Request } from '@playwright/test'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

async function openSettingsAfterFlagRead(
  comfyPage: ComfyPage,
  cloudFlagReads: Request[]
) {
  await expect
    .poll(() => cloudFlagReads.length, 'Cloud flag never read')
    .toBeGreaterThan(0)
  await comfyPage.settingDialog.open()
  return comfyPage.settingDialog
}

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

    test('keeps Plan & Credits in Settings', async ({
      comfyPage,
      cloudFlagReads
    }) => {
      const settings = await openSettingsAfterFlagRead(
        comfyPage,
        cloudFlagReads
      )

      await expect(
        settings.category('Plan & Credits', { exact: true })
      ).toBeVisible()
      await expect(settings.category('Billing', { exact: true })).toHaveCount(0)
    })
  })

  test.describe('flag on', () => {
    test.use({ localBillingWeb: true })

    test('opens billing-web at the issued entry URL', async ({
      comfyPage,
      handoffRequests,
      openAddCredits
    }) => {
      const page = comfyPage.page
      const popupOpened = page.waitForEvent('popup')
      await openAddCredits()
      const popup = await popupOpened

      await expect(popup).toHaveURL(ENTRY_URL)
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
          surface: 'local_web'
        })
      )
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })

    test('shows the Billing tab in Settings instead of Plan & Credits', async ({
      comfyPage,
      cloudFlagReads
    }) => {
      const settings = await openSettingsAfterFlagRead(
        comfyPage,
        cloudFlagReads
      )

      await settings.category('Billing', { exact: true }).click()
      await expect(comfyPage.page.getByTestId('billing-tab')).toBeVisible()
      await expect(
        settings.category('Plan & Credits', { exact: true })
      ).toHaveCount(0)
    })

    test.describe('when Cloud refuses the handoff', () => {
      test.use({ handoffReply: OWNER_ONLY })

      test('closes the tab and shows the server message', async ({
        comfyPage,
        handoffRequests,
        openAddCredits
      }) => {
        const page = comfyPage.page
        const popupOpened = page.waitForEvent('popup')
        await openAddCredits()
        const popup = await popupOpened

        await expect(comfyPage.toast.withText(OWNER_ONLY_MESSAGE)).toBeVisible()
        await expect.poll(() => popup.isClosed()).toBe(true)
        expect(handoffRequests).toHaveLength(1)
        await expect(page.getByRole('dialog')).toHaveCount(0)
      })
    })
  })
})
