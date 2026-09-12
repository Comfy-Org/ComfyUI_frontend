import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBilling'
import { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudBilling'
import {
  installContextNetworkIsolation,
  networkIsolationFixture as base
} from '@e2e/fixtures/networkIsolationFixture'
import {
  installLiveCloudBillingRouting,
  signInToLiveCloud
} from '@e2e/fixtures/utils/liveCloudBillingContext'
import {
  loadLiveCloudBillingConfig,
  loadLiveCloudBillingEndpoints
} from '@e2e/fixtures/utils/liveCloudBillingConfig'

interface FreshBillingSession {
  billingSession: LiveCloudBillingSession
  checkout: LiveCloudCheckout
}

export const liveCloudBillingFixture = base.extend<{
  billingSession: LiveCloudBillingSession
  comfyPage: ComfyPage
  checkout: LiveCloudCheckout
  freshBillingSession: () => Promise<FreshBillingSession>
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  networkPolicy: async ({ baseURL }, use, testInfo) => {
    const config = loadLiveCloudBillingEndpoints()
    const origins = new Set([
      new URL(baseURL ?? config.PLAYWRIGHT_TEST_URL).origin,
      config.PLAYWRIGHT_SETUP_API_URL,
      ...(config.PLAYWRIGHT_SETUP_API_URL === 'https://testcloud.comfy.org'
        ? ['https://testapi.comfy.org']
        : []),
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://dreamboothy-dev.firebaseapp.com',
      'https://checkout.stripe.com',
      'https://checkout.comfy.org',
      'https://testmode-acs.stripe.com',
      'https://hooks.stripe.com',
      'https://api.stripe.com',
      'https://js.stripe.com',
      'https://m.stripe.network',
      'https://m.stripe.com',
      'https://r.stripe.com',
      'https://q.stripe.com',
      'https://b.stripecdn.com'
    ])
    const unexpected = new Set<string>()
    await use({ origins, unexpected })
    const blocked = [...unexpected]
    await testInfo.attach('blocked-egress.json', {
      body: JSON.stringify(blocked),
      contentType: 'application/json'
    })
    expect(
      blocked.filter((entry) => /^(API|Navigation) /.test(entry)),
      'Unexpected API or navigation destination'
    ).toEqual([])
  },
  context: async ({ context, networkPolicy }, use) => {
    await installLiveCloudBillingRouting(context, networkPolicy)
    await use(context)
    await context.unrouteAll({ behavior: 'ignoreErrors' })
  },
  billingSession: async ({ page }, use) => {
    await use(await signInToLiveCloud(page))
  },
  freshBillingSession: async (
    { browser, contextOptions, networkPolicy },
    use
  ) => {
    const config = loadLiveCloudBillingConfig()
    const contexts: BrowserContext[] = []
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
          config.PLAYWRIGHT_TEST_URL
        )
        await installLiveCloudBillingRouting(context, networkPolicy)
        const page = await context.newPage()
        const billingSession = await signInToLiveCloud(page)
        const comfyPage = new ComfyPage(page, context.request)
        return {
          billingSession,
          checkout: new LiveCloudCheckout(comfyPage, config.PLAYWRIGHT_TEST_URL)
        }
      })
    } finally {
      for (const context of contexts) {
        await context.unrouteAll({ behavior: 'ignoreErrors' })
        await context.close()
      }
    }
  },
  comfyPage: async ({ page, request }, use) => {
    await use(new ComfyPage(page, request))
  },
  checkout: async ({ comfyPage, billingSession }, use, testInfo) => {
    await billingSession.assertNoCardAccount(testInfo)
    const checkout = new LiveCloudCheckout(
      comfyPage,
      loadLiveCloudBillingConfig().PLAYWRIGHT_TEST_URL
    )
    await checkout.open()
    await use(checkout)
  }
})

export { expect as comfyExpect } from '@playwright/test'
