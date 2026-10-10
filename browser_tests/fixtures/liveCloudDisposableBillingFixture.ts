import { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import { createDisposableCloudAccount } from '@e2e/fixtures/helpers/LiveCloudDisposableAccount'
import { liveCloudBillingFixture } from '@e2e/fixtures/liveCloudBillingFixture'
import { signInToLiveCloud } from '@e2e/fixtures/utils/liveCloudBillingContext'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export const liveCloudDisposableBillingFixture =
  liveCloudBillingFixture.extend<{
    disposableAccount: Awaited<ReturnType<typeof createDisposableCloudAccount>>
    disposableCheckout: {
      billingSession: LiveCloudBillingSession
      checkout: LiveCloudCheckout
    }
  }>({
    liveCloudBillingConfig: async ({}, use) => {
      await use(
        loadLiveCloudBillingConfig({
          allowAccountCreation: true,
          allowPayments: true,
          allowCheckout: true
        })
      )
    },
    disposableAccount: async ({ context }, use) => {
      await use(await createDisposableCloudAccount(context.request))
    },
    billingSession: async (
      { page, disposableAccount, liveCloudBillingConfig },
      use
    ) => {
      if (!liveCloudBillingConfig)
        throw new Error('Live billing config required')
      await use(
        await signInToLiveCloud(page, {
          ...liveCloudBillingConfig,
          CLOUD_ACCOUNT_EMAIL: disposableAccount.email,
          CLOUD_ACCOUNT_PASSWORD: disposableAccount.password
        })
      )
    },
    disposableCheckout: async (
      { comfyPage, billingSession, liveCloudBillingConfig, disposableAccount },
      use,
      testInfo
    ) => {
      if (!liveCloudBillingConfig)
        throw new Error('Live billing config required')
      await billingSession.assertNoCardAccount(testInfo)
      await billingSession.ensureProvisioned(
        liveCloudBillingConfig.PLAYWRIGHT_TEST_URL
      )
      await testInfo.attach('disposable-account.json', {
        body: JSON.stringify({
          email: disposableAccount.email,
          userId: disposableAccount.userId
        }),
        contentType: 'application/json'
      })
      await use({
        billingSession,
        checkout: new LiveCloudCheckout(
          comfyPage,
          liveCloudBillingConfig.PLAYWRIGHT_TEST_URL,
          liveCloudBillingConfig.PLAYWRIGHT_SETUP_API_URL
        )
      })
    }
  })

export { expect } from '@playwright/test'
