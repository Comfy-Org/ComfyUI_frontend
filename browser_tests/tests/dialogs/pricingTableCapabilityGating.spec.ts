import type { Page } from '@playwright/test'
import type { BillingCapabilities } from '@comfyorg/ingest-types'

import {
  cloudAppExpect,
  cloudAppFixture as test
} from '@e2e/fixtures/cloudAppFixture'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The pricing table's plan CTAs are gated on the server capability set alone
 * (FE-2030). These drive the real dialog against capability responses shaped
 * like the INC-128 cohorts, so a regression shows up as a dead button rather
 * than a changed expression.
 */
const OWNER = workspace('personal', 'owner')

const BOOT_FEATURES = { billing_control_enabled: true }

// The billing status the app boots with: an active paid plan, which is what
// makes the cards read "Change to ..." rather than "Subscribe to ...".
async function openPricingTable(
  page: Page,
  options: {
    capabilities?: Partial<BillingCapabilities>
    unresolved?: boolean
    status?: number
  } = {}
) {
  await setupCloudApp(page, {
    workspace: OWNER,
    features: BOOT_FEATURES,
    billingCapabilities: options.unresolved
      ? new Promise(() => {})
      : createBillingCapabilities(OWNER.id, options.capabilities),
    billingCapabilitiesStatus: options.status
  })

  await page.goto(`${APP_URL}/?pricing=1`)
  await cloudAppExpect(
    page.getByRole('heading', { name: 'Choose a Plan' })
  ).toBeVisible()
}

const creatorCta = (page: Page) =>
  page.getByRole('button', { name: 'Change to Creator Yearly' })

test.describe('Pricing table capability gating', { tag: '@cloud' }, () => {
  test('acts on the capability the server granted, not the one the tier implies', async ({
    page
  }) => {
    // The legacy-rail shape: a paid tier the server lets subscribe, with
    // change-seats cleared because there is no local subscription row.
    await openPricingTable(page, {
      capabilities: { can_subscribe_self_serve: true, can_change_seats: false }
    })

    await cloudAppExpect(creatorCta(page)).toBeEnabled()
  })

  // The closed direction cannot be reached from here: every entry point to the
  // catalog is itself gated on can_subscribe_self_serve, so a resolved refusal
  // withholds the dialog rather than opening it with dead cards. Asserting that
  // is the negative control; the disabled CTA itself is covered in
  // UnifiedPricingTable.test.ts, which can render the table directly.
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

  test('keeps the cards live while the capability read has not resolved', async ({
    page
  }) => {
    await openPricingTable(page, { unresolved: true })

    await cloudAppExpect(creatorCta(page)).toBeEnabled()
  })

  test('keeps the cards live when the capability read fails', async ({
    page
  }) => {
    await openPricingTable(page, { status: 500 })

    await cloudAppExpect(creatorCta(page)).toBeEnabled()
  })
})
