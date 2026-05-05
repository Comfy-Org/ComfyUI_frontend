import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createSubscriptionHelper,
  withActiveSubscription,
  withCredits
} from '@e2e/fixtures/helpers/SubscriptionHelper'
import type { SubscriptionHelper } from '@e2e/fixtures/helpers/SubscriptionHelper'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * The `*_balance_micros` fields on the mocked balance response are consumed by
 * the UI through `formatCreditsFromCents`, which treats the value as cents
 * (despite the field name). Keep this helper colocated with the assertions so
 * the unit translation is explicit.
 */
const usdToBalanceUnits = (usd: number): number => Math.round(usd * 100)

async function openUserPopover(page: Page): Promise<Locator> {
  // Use dispatchEvent to bypass the subscription-required dialog backdrop that
  // can transiently overlay the topbar during page boot, mirroring the
  // canonical pattern used in subscription.spec.ts.
  await page.getByTestId(TestIds.user.currentUserButton).dispatchEvent('click')
  const popover = page.getByTestId(TestIds.user.currentUserPopover)
  await expect(popover).toBeVisible()
  return popover
}

async function dismissSubscriptionDialogIfOpen(page: Page): Promise<void> {
  const dialog = page.locator('[aria-labelledby="subscription-required"]')
  const appeared = await expect(dialog)
    .toBeVisible({ timeout: 2000 })
    .then(() => true)
    .catch((e: Error) => {
      if (e.message.includes('Timeout')) return false
      throw e
    })
  if (!appeared) return
  const closeButton = dialog.getByRole('button', { name: /close/i }).first()
  if (await closeButton.isVisible()) {
    await closeButton.click()
  } else {
    await page.keyboard.press('Escape')
  }
  await expect(dialog).toBeHidden()
}

function createCreditsTest(
  ...defaultOps: Parameters<typeof createSubscriptionHelper>[1][]
) {
  return comfyPageFixture.extend<{
    subscriptionHelper: SubscriptionHelper
  }>({
    subscriptionHelper: [
      async ({ comfyPage }, use) => {
        const helper = createSubscriptionHelper(comfyPage.page, ...defaultOps)
        await helper.mock()
        // Disable the cloud-subscription extension so its watcher does not
        // auto-open the subscription dialog on app boot — the PrimeVue
        // Dialog mask would otherwise intercept pointer events on the topbar.
        await comfyPage.setupSettings({
          'Comfy.Extension.Disabled': ['Comfy.Cloud.Subscription']
        })
        await comfyPage.page.reload()
        // Wait for Firebase auth so the topbar user button is rendered before
        // the test body runs.
        await expect(
          comfyPage.page.getByTestId(TestIds.user.currentUserButton)
        ).toBeVisible()
        await dismissSubscriptionDialogIfOpen(comfyPage.page)
        await use(helper)
        await helper.clearMocks()
      },
      { auto: true }
    ]
  })
}

const FIVE_USD_OPS = [
  withActiveSubscription('CREATOR'),
  withCredits(usdToBalanceUnits(5))
]

const FIFTY_CENT_OPS = [
  withActiveSubscription('CREATOR'),
  withCredits(usdToBalanceUnits(0.5))
]

const fiveDollarTest = createCreditsTest(...FIVE_USD_OPS)
const fiftyCentTest = createCreditsTest(...FIFTY_CENT_OPS)

fiveDollarTest.describe(
  'Credits — popover balance ($5)',
  { tag: '@cloud' },
  () => {
    fiveDollarTest(
      'shows formatted credits derived from the balance response',
      async ({ comfyPage }) => {
        const popover = await openUserPopover(comfyPage.page)
        const balance = popover.getByTestId(
          TestIds.credits.popoverCreditBalance
        )
        await expect(balance).toHaveText('1,055')
      }
    )

    fiveDollarTest(
      'add credits button is visible for active paid subscribers',
      async ({ comfyPage }) => {
        const popover = await openUserPopover(comfyPage.page)
        await expect(
          popover.getByTestId(TestIds.credits.addCreditsButton)
        ).toBeVisible()
      }
    )
  }
)

fiftyCentTest.describe(
  'Credits — popover balance ($0.50)',
  { tag: '@cloud' },
  () => {
    fiftyCentTest(
      'renders sub-dollar balances as whole credits',
      async ({ comfyPage }) => {
        const popover = await openUserPopover(comfyPage.page)
        const balance = popover.getByTestId(
          TestIds.credits.popoverCreditBalance
        )
        await expect(balance).toHaveText('106')
      }
    )
  }
)

fiveDollarTest.describe(
  'Credits — top-up dialog conversions',
  { tag: '@cloud' },
  () => {
    async function openTopUpDialog(page: Page): Promise<void> {
      const popover = await openUserPopover(page)
      await popover.getByTestId(TestIds.credits.addCreditsButton).click()
      await expect(
        page.getByTestId(TestIds.credits.topUpPayAmount)
      ).toBeVisible()
    }

    fiveDollarTest(
      'default $50 selection renders 10,550 credits in You Get',
      async ({ comfyPage }) => {
        await openTopUpDialog(comfyPage.page)
        const getInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpGetAmount)
          .getByRole('textbox')
        await expect(getInput).toHaveValue('10,550')
      }
    )

    fiveDollarTest(
      '$10 preset updates You Get to usdToCredits(10) = 2,110',
      async ({ comfyPage }) => {
        await openTopUpDialog(comfyPage.page)
        await comfyPage.page
          .getByRole('button', { name: '$10', exact: true })
          .click()

        const getInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpGetAmount)
          .getByRole('textbox')
        const payInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpPayAmount)
          .getByRole('textbox')

        await expect(getInput).toHaveValue('2,110')
        await expect(payInput).toHaveValue('10')
      }
    )

    fiveDollarTest(
      '$100 preset updates You Get to usdToCredits(100) = 21,100',
      async ({ comfyPage }) => {
        await openTopUpDialog(comfyPage.page)
        await comfyPage.page
          .getByRole('button', { name: '$100', exact: true })
          .click()

        const getInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpGetAmount)
          .getByRole('textbox')
        const payInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpPayAmount)
          .getByRole('textbox')

        await expect(getInput).toHaveValue('21,100')
        await expect(payInput).toHaveValue('100')
      }
    )

    fiveDollarTest(
      'incrementing You Pay updates You Get via usdToCredits',
      async ({ comfyPage }) => {
        await openTopUpDialog(comfyPage.page)
        const payContainer = comfyPage.page.getByTestId(
          TestIds.credits.topUpPayAmount
        )
        await payContainer.getByRole('button', { name: /increment/i }).click()

        const getInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpGetAmount)
          .getByRole('textbox')
        const payInput = payContainer.getByRole('textbox')
        await expect(payInput).toHaveValue('55')
        await expect(getInput).toHaveValue('11,605')
      }
    )

    fiveDollarTest(
      'incrementing You Get updates You Pay via creditsToUsd',
      async ({ comfyPage }) => {
        await openTopUpDialog(comfyPage.page)
        const getContainer = comfyPage.page.getByTestId(
          TestIds.credits.topUpGetAmount
        )
        await getContainer.getByRole('button', { name: /increment/i }).click()

        const payInput = comfyPage.page
          .getByTestId(TestIds.credits.topUpPayAmount)
          .getByRole('textbox')
        const getInput = getContainer.getByRole('textbox')
        await expect(getInput).toHaveValue('11,605')
        await expect(payInput).toHaveValue('55')
      }
    )
  }
)
