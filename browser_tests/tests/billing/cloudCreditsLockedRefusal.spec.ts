import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import type { BillingEventsResponse } from '@comfyorg/ingest-types'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import {
  DEFAULT_TEAM_MEMBERS,
  PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { expectPlatformPlansOpened } from '@e2e/fixtures/utils/platformPlans'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const FREE_ACCOUNT_WITH_CREDITS = {
  ...PERSONAL_BILLING_STATUS,
  is_active: true,
  subscription_status: undefined
}

for (const release of [
  {
    version: '1.60',
    enabled: false,
    memberColumns: 0,
    primaryAction: 'Add credits',
    newDialogs: 0
  },
  {
    version: '1.61',
    enabled: true,
    memberColumns: 1,
    primaryAction: 'Continue',
    newDialogs: 1
  }
]) {
  test.describe(
    `Billing ${release.version} selected by /features`,
    { tag: '@cloud' },
    () => {
      test.use({ billingNewUx: false })

      test('selects the release Activity columns and Add credits UI from the same account facts', async ({
        page
      }) => {
        test.setTimeout(60_000)
        const billing = new CloudWorkspaceMockHelper(page)
        await billing.setup(
          DEFAULT_TEAM_MEMBERS,
          workspace('personal', 'owner'),
          {
            ...PERSONAL_BILLING_STATUS,
            billing_status: 'paid',
            is_active: true,
            subscription_status: 'active',
            subscription_tier: 'PRO',
            subscription_duration: 'MONTHLY',
            plan_slug: 'pro-monthly'
          }
        )
        await page.route('**/api/features', (route) =>
          route.fulfill(jsonRoute({ billing_new_ux_enabled: release.enabled }))
        )
        const events: BillingEventsResponse = {
          events: [
            {
              event_id: 'billing-rollout-event',
              event_type: 'api_usage_completed',
              createdAt: '2026-11-10T12:00:00Z',
              params: { api_name: 'Rollout test node' },
              member_display_name: 'Ada Lovelace'
            }
          ],
          page: 1,
          limit: 7,
          total: 1,
          totalPages: 1
        }
        await page.route('**/api/billing/events**', (route) =>
          route.fulfill(jsonRoute(events))
        )
        await page.route('**/api/billing/payment-methods', (route) =>
          route.fulfill(jsonRoute([]))
        )
        await page.route('**/api/billing/topup/quote', (route) =>
          route.fulfill(jsonRoute({ credits: 1000 }))
        )

        const content = await billing.openPlanAndCreditsSettings()
        await content
          .getByRole('button', { name: 'Activity', exact: true })
          .click()
        await expect(content.getByText('Rollout test node')).toBeVisible()
        await expect(
          content.getByRole('columnheader', { name: 'Member' })
        ).toHaveCount(release.memberColumns)
        await expect(content.getByText('Ada Lovelace')).toHaveCount(
          release.memberColumns
        )

        await content
          .getByRole('button', { name: 'Credits', exact: true })
          .click()
        await content
          .getByRole('button', { name: 'Add credits', exact: true })
          .click()

        const dialog = page.locator('[data-dialog-key="top-up-credits"]')
        await expect(dialog).toBeVisible()
        await expect(
          dialog.getByRole('button', {
            name: release.primaryAction,
            exact: true
          })
        ).toBeVisible()
        await expect(dialog.getByTestId('add-credits-dialog')).toHaveCount(
          release.newDialogs
        )
      })
    }
  )
}

async function runAndGetRefused(page: Page, creditsLocked: boolean) {
  await page.route('**/api/prompt', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          ...jsonRoute({
            node_errors: {},
            error: {
              type: 'CLOUD_SUBSCRIPTION_REQUIRED',
              message: 'A cloud subscription is required to queue workflows.',
              credits_locked: creditsLocked
            }
          }),
          status: 402
        })
      : route.fallback()
  )

  await page.goto(APP_URL)
  await waitForCloudApp(page)

  await page.getByTestId(TestIds.topbar.queueButton).click()
}

test.describe('Run refused without a plan', { tag: '@cloud' }, () => {
  const ROWS = [
    {
      subscriptionState: 'never_subscribed',
      body: 'Running workflows on Cloud needs a plan.'
    },
    {
      subscriptionState: 'ended',
      body: 'Your plan has ended. Resubscribe to keep running workflows on Cloud.'
    }
  ] as const

  for (const { subscriptionState, body } of ROWS) {
    for (const creditsLocked of [true, false]) {
      test(`explains the refused run and links to the Plans page (${subscriptionState}, credits_locked: ${creditsLocked})`, async ({
        page
      }) => {
        await new CloudWorkspaceMockHelper(page).setup(
          DEFAULT_TEAM_MEMBERS,
          workspace('personal', 'owner'),
          {
            ...FREE_ACCOUNT_WITH_CREDITS,
            subscription_state: subscriptionState
          },
          { can_run_workflows: true }
        )
        await page.route('**/api/features', (route) =>
          route.fulfill(jsonRoute({ subscription_required: true }))
        )
        const tabsBeforeRun = page.context().pages().length

        await runAndGetRefused(page, creditsLocked)

        const dialog = page.getByTestId('platform-plans-link-dialog')
        await expect(dialog).toBeVisible()
        await expect(dialog.getByText("Your workflow didn't run")).toBeVisible()
        await expect(dialog.getByText(body)).toBeVisible()
        expect(
          page.context().pages(),
          'the refusal opens no tab on its own'
        ).toHaveLength(tabsBeforeRun)

        await expectPlatformPlansOpened(page, () =>
          dialog.getByRole('link', { name: 'Choose a plan' }).click()
        )
        await expect(dialog).toBeHidden()
      })
    }
  }
})

test.describe(
  '1.60 billing with the new UX disabled',
  { tag: '@cloud' },
  () => {
    test.use({ billingNewUx: false })

    test('hands a refused run directly to Plans without the 1.61 explanation', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        workspace('personal', 'owner'),
        {
          ...FREE_ACCOUNT_WITH_CREDITS,
          subscription_state: 'never_subscribed'
        },
        { can_run_workflows: true }
      )
      await page.route('**/api/features', (route) =>
        route.fulfill(jsonRoute({ subscription_required: true }))
      )

      await expectPlatformPlansOpened(page, () => runAndGetRefused(page, true))

      await expect(page.getByTestId('platform-plans-link-dialog')).toBeHidden()
    })
  }
)

async function arrangeEndedPlan(page: Page, hasFunds: boolean) {
  await new CloudWorkspaceMockHelper(page).setup(
    DEFAULT_TEAM_MEMBERS,
    workspace('personal', 'owner'),
    {
      ...PERSONAL_BILLING_STATUS,
      subscription_state: 'ended',
      has_funds: hasFunds
    }
  )
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute({ subscription_required: true }))
  )
}

async function clickSubscribeToRun(page: Page) {
  await page.goto(APP_URL)
  await waitForCloudApp(page)
  await page.getByTestId(TestIds.topbar.subscribeToRunButton).click()
}

test.describe('Subscribe to Run for an ended plan', { tag: '@cloud' }, () => {
  for (const hasFunds of [true, false]) {
    test(`opens the platform Plans page (has_funds: ${hasFunds})`, async ({
      page
    }) => {
      await arrangeEndedPlan(page, hasFunds)

      await expectPlatformPlansOpened(page, () => clickSubscribeToRun(page))
    })
  }
})
