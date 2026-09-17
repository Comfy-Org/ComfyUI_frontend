import type { BrowserContext } from '@playwright/test'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'
import { installContextNetworkIsolation } from '@e2e/fixtures/networkIsolationFixture'
import { signInToLiveCloud } from '@e2e/fixtures/utils/liveCloudBillingContext'
import { liveCloudBillingFixture as base } from '@e2e/fixtures/liveCloudBillingFixture'

interface FreshBillingSession {
  comfyPage: ComfyPage
  billingSession: LiveCloudBillingSession
  checkout: LiveCloudCheckout
}

export const liveCloudCheckoutFixture = base.extend<{
  checkout: LiveCloudCheckout
  freshBillingSession: () => Promise<FreshBillingSession>
}>({
  liveCloudBillingConfig: async ({ liveCloudBillingConfig }, use) => {
    if (!liveCloudBillingConfig) throw new Error('Live billing config required')
    await use({ ...liveCloudBillingConfig, allowCheckout: true })
  },
  freshBillingSession: async (
    { browser, contextOptions, networkPolicy, liveCloudBillingConfig },
    use,
    testInfo
  ) => {
    const config = liveCloudBillingConfig
    if (!config) throw new Error('Live billing config required')
    const contexts: BrowserContext[] = []
    const tracedContexts = new Set<BrowserContext>()
    try {
      await use(async () => {
        const context = await browser.newContext({
          ...contextOptions,
          baseURL: config.PLAYWRIGHT_TEST_URL,
          storageState: { cookies: [], origins: [] },
          serviceWorkers: 'block',
          recordVideo: undefined,
          recordHar: undefined
        })
        contexts.push(context)
        await installContextNetworkIsolation(
          context,
          networkPolicy,
          config.PLAYWRIGHT_TEST_URL,
          config
        )
        const page = await context.newPage()
        const billingSession = await signInToLiveCloud(
          page,
          liveCloudBillingConfig
        )
        await context.tracing.start({ screenshots: true, snapshots: true })
        tracedContexts.add(context)
        const comfyPage = new ComfyPage(page, context.request)
        return {
          comfyPage,
          billingSession,
          checkout: new LiveCloudCheckout(
            comfyPage,
            config.PLAYWRIGHT_TEST_URL,
            config.PLAYWRIGHT_SETUP_API_URL
          )
        }
      })
    } finally {
      for (const [index, context] of contexts.entries()) {
        if (tracedContexts.has(context)) {
          const path = testInfo.outputPath(`fresh-billing-trace-${index}.zip`)
          await context.tracing.stop({ path })
          await testInfo.attach('trace', {
            path,
            contentType: 'application/zip'
          })
        }
        await context.unrouteAll({ behavior: 'ignoreErrors' })
        await context.close()
      }
    }
  },
  checkout: async (
    { comfyPage, billingSession, liveCloudBillingConfig },
    use,
    testInfo
  ) => {
    if (!liveCloudBillingConfig) throw new Error('Live billing config required')
    await billingSession.assertNoCardAccount(testInfo)
    const checkout = new LiveCloudCheckout(
      comfyPage,
      liveCloudBillingConfig.PLAYWRIGHT_TEST_URL,
      liveCloudBillingConfig.PLAYWRIGHT_SETUP_API_URL
    )
    await checkout.open()
    await use(checkout)
  }
})

export { expect as comfyExpect } from '@playwright/test'
