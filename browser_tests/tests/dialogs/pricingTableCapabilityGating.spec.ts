import type { Page } from '@playwright/test'
import type {
  BillingCapabilities,
  BillingPlansResponse,
  Plan
} from '@comfyorg/ingest-types'

import {
  cloudAppExpect,
  cloudAppFixture as test
} from '@e2e/fixtures/cloudAppFixture'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { createPlan } from '@e2e/fixtures/data/billingPlans'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const OWNER = workspace('personal', 'owner')

const BOOT_FEATURES = { billing_control_enabled: true }

const CHANGE_CREATOR = { action: 'change' } as const

async function gotoPricingDeepLink(
  page: Page,
  options: {
    creator: Pick<Plan, 'action'> & { deniedReason?: Plan['denied_reason'] }
    capabilities?: Partial<BillingCapabilities>
    unresolved?: boolean
    status?: number
  }
) {
  await setupCloudApp(page, {
    workspace: OWNER,
    features: BOOT_FEATURES,
    billingCapabilities: options.unresolved
      ? new Promise(() => {})
      : createBillingCapabilities(OWNER.id, options.capabilities),
    billingCapabilitiesStatus: options.status
  })
  await page.route('**/api/billing/plans', (route) =>
    route.fulfill(
      jsonRoute({
        plans: [
          createPlan({
            slug: 'creator-annual',
            tier: 'CREATOR',
            duration: 'ANNUAL',
            priceCents: 33_600,
            monthlyCredits: 7_400,
            ...options.creator
          })
        ]
      } satisfies BillingPlansResponse)
    )
  )

  await page.goto(`${APP_URL}/?pricing=1`)
}

async function openPricingTable(
  page: Page,
  options: Parameters<typeof gotoPricingDeepLink>[1]
) {
  await gotoPricingDeepLink(page, options)
  await cloudAppExpect(
    page.getByRole('heading', { name: 'Choose a Plan' })
  ).toBeVisible()
}

test.describe('Pricing table plan action', { tag: '@cloud' }, () => {
  test('renders the plan action the server sent, not the capability the tier implies', async ({
    page
  }) => {
    await openPricingTable(page, {
      creator: CHANGE_CREATOR,
      capabilities: { can_subscribe_self_serve: true, can_change_seats: false }
    })

    await cloudAppExpect(
      page.getByRole('button', { name: 'Change to Creator Yearly' })
    ).toBeEnabled()
  })

  test('disables a plan the server answers none for and says why', async ({
    page
  }) => {
    await openPricingTable(page, {
      creator: { action: 'none', deniedReason: 'billing_operation_parked' }
    })

    await cloudAppExpect(
      page.getByRole('button', { name: 'Creator Yearly', exact: true })
    ).toBeDisabled()
    await cloudAppExpect(
      page.getByText(
        'A recent billing change needs a fix from our team. Contact support to change your plan.'
      )
    ).toBeVisible()
  })

  test('withholds the catalog when the server refuses every lifecycle write', async ({
    page
  }) => {
    await setupCloudApp(page, {
      workspace: OWNER,
      features: BOOT_FEATURES,
      billingCapabilities: createBillingCapabilities(OWNER.id, {
        can_subscribe_self_serve: false,
        can_change_seats: false,
        can_reactivate: false,
        can_downgrade_to_personal: false
      })
    })

    await page.goto(`${APP_URL}/?pricing=1`)

    await cloudAppExpect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeHidden()
  })

  test('holds the catalog while the capability read has not resolved', async ({
    page
  }) => {
    const capabilityRequest = page.waitForRequest('**/api/billing/capabilities')
    await gotoPricingDeepLink(page, {
      creator: CHANGE_CREATOR,
      unresolved: true
    })
    await capabilityRequest
    await page.waitForURL((url) => !url.searchParams.has('pricing'))

    await cloudAppExpect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeHidden()
  })

  test('withholds the catalog when the capability read fails', async ({
    page
  }) => {
    const capabilityResponse = page.waitForResponse(
      '**/api/billing/capabilities'
    )
    await gotoPricingDeepLink(page, { creator: CHANGE_CREATOR, status: 500 })
    await capabilityResponse
    await page.waitForURL((url) => !url.searchParams.has('pricing'))

    await cloudAppExpect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeHidden()
  })
})
