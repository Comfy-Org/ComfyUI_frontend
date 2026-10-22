import { expect } from '@playwright/test'
import type { PreviewSubscribeResponse } from '@comfyorg/ingest-types'

import type { BillingPlansResponse } from '@/platform/workspace/api/workspaceApi'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import {
  DEFAULT_TEAM_MEMBERS,
  LEGACY_PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
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

test.describe('Cloud subscribe deep link', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('dismisses the splash loader and opens the unified personal checkout', async ({
    page
  }) => {
    const helper = new CloudWorkspaceMockHelper(page)
    await helper.setup(DEFAULT_TEAM_MEMBERS, workspace('personal', 'owner'), {
      ...LEGACY_PERSONAL_BILLING_STATUS,
      billing_rail: 'stripe'
    })
    await page.route('**/api/billing/plans', (r) =>
      r.fulfill(jsonRoute(CREATOR_MONTHLY_PLANS))
    )
    await page.route('**/api/billing/preview-subscribe', (r) =>
      r.fulfill(jsonRoute(CREATOR_MONTHLY_PREVIEW))
    )

    // The OSS server that hosts the built frontend in CI has no SPA fallback
    // for /cloud/subscribe (Chromium treats its response as a download), so
    // serve the app shell for the deep-link document request directly. The
    // base tag keeps the shell's relative asset paths resolving from the root.
    const appShell = await page.request
      .get(APP_URL)
      .then((response) => response.text())
      .then((html) => html.replace('<head>', '<head><base href="/">'))
    await page.route('**/cloud/subscribe*', (route) =>
      route.request().resourceType() === 'document'
        ? route.fulfill({ contentType: 'text/html', body: appShell })
        : route.fallback()
    )

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
