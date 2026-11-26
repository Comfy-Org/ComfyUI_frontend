import { expect } from '@playwright/test'
import type { PreviewSubscribeResponse } from '@comfyorg/ingest-types'

import type { Page } from '@playwright/test'

import type { BillingPlansResponse } from '@comfyorg/billing-core'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import {
  DEFAULT_TEAM_MEMBERS,
  INACTIVE_TEAM_BILLING_STATUS,
  PERSONAL_BILLING_STATUS,
  TEAM_BILLING_STATUS,
  TEAM_MEMBER_WORKSPACE,
  TEAM_WORKSPACE
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  keepPricingTableInApp,
  PLATFORM_PLANS_PATH
} from '@e2e/fixtures/utils/platformPlans'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const CREATOR_MONTHLY_PLAN = createPlan({
  slug: 'creator-monthly',
  tier: 'CREATOR',
  duration: 'MONTHLY',
  priceCents: 2000,
  monthlyCredits: 2400
})

const CREATOR_MONTHLY_PLANS = {
  plans: [CREATOR_MONTHLY_PLAN]
} satisfies BillingPlansResponse

const CREATOR_MONTHLY_PREVIEW = {
  allowed: true,
  transition_type: 'new_subscription',
  is_immediate: true,
  effective_at: '2026-08-24T00:00:00Z',
  cost_today_cents: 2000,
  cost_next_period_cents: 2000,
  credits_today_cents: CREATOR_MONTHLY_PLAN.credits_cents,
  credits_next_period_cents: CREATOR_MONTHLY_PLAN.credits_cents,
  new_plan: CREATOR_MONTHLY_PLAN
} satisfies PreviewSubscribeResponse

async function serveAppShellForDeepLink(page: Page) {
  const appShell = await page.request
    .get(APP_URL)
    .then((response) => response.text())
    .then((html) => html.replace('<head>', '<head><base href="/">'))
  await page.route('**/cloud/subscribe*', (route) =>
    route.request().resourceType() === 'document'
      ? route.fulfill({ contentType: 'text/html', body: appShell })
      : route.fallback()
  )
}

async function serveNewBillingUi(page: Page) {
  await page.route('**/api/features', (route) =>
    route.fulfill(
      jsonRoute({ billing_new_ux_enabled: true, pricing_table_fallback: false })
    )
  )
  await page
    .context()
    .route(`**${PLATFORM_PLANS_PATH}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: 'Plans' })
    )
}

async function blockPopups(page: Page) {
  await page.addInitScript(() => {
    window.open = () => null
  })
}

async function serveCapabilitiesAfterBillingStatus(page: Page) {
  const statusServed = page.waitForResponse('**/api/billing/status')
  await page.route('**/api/billing/capabilities', async (route) => {
    await statusServed
    await route.fallback()
  })
}

test.describe('Cloud subscribe deep link', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test.describe('with the new billing UI on', () => {
    test.describe('with a never-subscribed owner', () => {
      test.beforeEach(async ({ page }) => {
        await new CloudWorkspaceMockHelper(page).setup(
          DEFAULT_TEAM_MEMBERS,
          workspace('personal', 'owner'),
          {
            ...PERSONAL_BILLING_STATUS,
            subscription_status: undefined,
            subscription_state: 'never_subscribed'
          }
        )
        await serveNewBillingUi(page)
        await serveAppShellForDeepLink(page)
      })

      for (const popupPolicy of ['blocked', 'allowed']) {
        test.describe(`with pop-ups ${popupPolicy}`, () => {
          if (popupPolicy === 'blocked') {
            test.beforeEach(async ({ page }) => {
              await blockPopups(page)
            })
          }

          test('takes the owner to Plans', async ({ page }) => {
            await page.goto(
              `${APP_URL}/cloud/subscribe?tier=standard&cycle=monthly`
            )

            await expect(page).toHaveURL(new RegExp(PLATFORM_PLANS_PATH), {
              timeout: 45_000
            })
            expect(new URL(page.url()).searchParams.has('tier')).toBe(false)
            expect(new URL(page.url()).searchParams.has('cycle')).toBe(false)
          })
        })
      }
    })

    test('forwards a pricing query to Platform Plans without selecting a plan', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        workspace('personal', 'owner'),
        PERSONAL_BILLING_STATUS
      )
      await serveNewBillingUi(page)

      await page.goto(`${APP_URL}/?pricing=standard&cycle=monthly`)

      await expect(page).toHaveURL(new RegExp(PLATFORM_PLANS_PATH), {
        timeout: 45_000
      })
      const destination = new URL(page.url())
      for (const param of ['pricing', 'tier', 'cycle', 'plan']) {
        expect(destination.searchParams.has(param)).toBe(false)
      }
    })

    test('keeps a team member in Cloud when they open a pricing query', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        TEAM_MEMBER_WORKSPACE,
        INACTIVE_TEAM_BILLING_STATUS
      )
      await serveNewBillingUi(page)

      const capabilities = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/billing/capabilities' &&
          response.ok()
      )
      await page.goto(`${APP_URL}/?pricing=standard&cycle=monthly`)

      await (await capabilities).finished()
      await expect(page).toHaveURL(new URL('/', APP_URL).href, {
        timeout: 45_000
      })
      await expect(
        page.getByRole('heading', { name: 'Choose a Plan' })
      ).toBeHidden()
    })

    test('takes an owner to the Plans page in the same tab when capabilities arrive after billing status', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        TEAM_WORKSPACE,
        INACTIVE_TEAM_BILLING_STATUS
      )
      await blockPopups(page)
      await serveNewBillingUi(page)
      await serveAppShellForDeepLink(page)
      await serveCapabilitiesAfterBillingStatus(page)

      await page.goto(`${APP_URL}/cloud/subscribe?tier=standard&cycle=monthly`)

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 45_000 })
        .toBe(PLATFORM_PLANS_PATH)
      expect(new URL(page.url()).searchParams.has('tier')).toBe(false)
    })

    test('leaves the redirect screen for the app when a member is told to ask the owner', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        TEAM_MEMBER_WORKSPACE,
        INACTIVE_TEAM_BILLING_STATUS
      )
      await blockPopups(page)
      await serveNewBillingUi(page)
      await serveAppShellForDeepLink(page)
      await serveCapabilitiesAfterBillingStatus(page)

      await page.goto(`${APP_URL}/cloud/subscribe?tier=standard&cycle=monthly`)

      await expect(page.getByTestId('member-resubscribe-message')).toBeVisible({
        timeout: 45_000
      })
      await page.getByRole('button', { name: 'Ok, got it' }).click()

      await expect(page.getByText('Subscribe to Standard')).toBeHidden()
      expect(new URL(page.url()).pathname).toBe('/')
    })

    test('takes an owner of a workspace with an active plan to the Plans page in the same tab', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        TEAM_WORKSPACE,
        TEAM_BILLING_STATUS
      )
      await blockPopups(page)
      await serveNewBillingUi(page)
      await serveAppShellForDeepLink(page)
      await serveCapabilitiesAfterBillingStatus(page)

      await page.goto(`${APP_URL}/cloud/subscribe?tier=standard&cycle=monthly`)

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 45_000 })
        .toBe(PLATFORM_PLANS_PATH)
    })

    test('moves a member of a workspace with an active plan to the app with no inactive notice', async ({
      page
    }) => {
      await new CloudWorkspaceMockHelper(page).setup(
        DEFAULT_TEAM_MEMBERS,
        TEAM_MEMBER_WORKSPACE,
        TEAM_BILLING_STATUS
      )
      await blockPopups(page)
      await serveNewBillingUi(page)
      await serveAppShellForDeepLink(page)
      await serveCapabilitiesAfterBillingStatus(page)

      await page.goto(`${APP_URL}/cloud/subscribe?tier=standard&cycle=monthly`)

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 45_000 })
        .toBe('/')
      await expect(page.getByText('Subscribe to Standard')).toBeHidden()
      await expect(page.getByTestId('member-resubscribe-message')).toBeHidden()
    })
  })

  test('dismisses the splash loader and opens the unified personal checkout', async ({
    page
  }) => {
    await keepPricingTableInApp(page)
    const helper = new CloudWorkspaceMockHelper(page)
    await helper.setup(
      DEFAULT_TEAM_MEMBERS,
      workspace('personal', 'owner'),
      PERSONAL_BILLING_STATUS
    )
    await page.route('**/api/billing/plans', (r) =>
      r.fulfill(jsonRoute(CREATOR_MONTHLY_PLANS))
    )
    await page.route('**/api/billing/preview-subscribe', (r) =>
      r.fulfill(jsonRoute(CREATOR_MONTHLY_PREVIEW))
    )

    await serveAppShellForDeepLink(page)

    const legacyCheckoutRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/customers/')) {
        legacyCheckoutRequests.push(request.url())
      }
    })

    await page.goto(`${APP_URL}/cloud/subscribe?tier=creator&cycle=monthly`)

    await expect(
      page.getByRole('heading', { name: 'Confirm your payment' })
    ).toBeVisible({ timeout: 45_000 })
    await expect(page.getByText('$20.00', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Renews at $20.00. Cancel anytime.')
    ).toBeVisible()
    await expect(page.locator('#splash-loader')).toHaveCount(0)
    expect(legacyCheckoutRequests).toEqual([])
  })
})
