import { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudBilling'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBilling'
import { createDisposableCloudAccount } from '@e2e/fixtures/helpers/LiveCloudDisposableAccount'
import { liveCloudBillingFixture } from '@e2e/fixtures/liveCloudBillingFixture'
import { signInToLiveCloud } from '@e2e/fixtures/utils/liveCloudBillingContext'
import { loadLiveCloudBillingEndpoints } from '@e2e/fixtures/utils/liveCloudBillingConfig'

interface DisposableCheckout {
  billingSession: LiveCloudBillingSession
  checkout: LiveCloudCheckout
}

export const liveCloudDisposableBillingFixture =
  liveCloudBillingFixture.extend<{
    disposableCheckout: DisposableCheckout
  }>({
    disposableCheckout: async ({ comfyPage, context }, use, testInfo) => {
      const account = await createDisposableCloudAccount(context.request)
      const billingSession = await signInToLiveCloud(comfyPage.page, account)
      await billingSession.assertNoCardAccount(testInfo)
      const frontend = loadLiveCloudBillingEndpoints().PLAYWRIGHT_TEST_URL
      await billingSession.ensureProvisioned(frontend)
      await testInfo.attach('disposable-account.json', {
        body: JSON.stringify({ email: account.email, userId: account.userId }),
        contentType: 'application/json'
      })
      await use({
        billingSession,
        checkout: new LiveCloudCheckout(comfyPage, frontend)
      })
    }
  })

export { expect } from '@playwright/test'
