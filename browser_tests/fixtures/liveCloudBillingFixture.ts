import { expect } from '@playwright/test'

import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import {
  LiveCloudBillingSession,
  LiveCloudCheckout,
  matchesBillingResponse
} from '@e2e/fixtures/helpers/LiveCloudBilling'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'

export const liveCloudBillingFixture = base.extend<{
  billingSession: LiveCloudBillingSession
  comfyPage: ComfyPage
  checkout: LiveCloudCheckout
}>({
  baseURL: process.env.PLAYWRIGHT_TEST_URL,
  networkPolicy: async ({ baseURL }, use, testInfo) => {
    const config = loadLiveCloudBillingConfig()
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
    const config = loadLiveCloudBillingConfig()
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (
        config.PLAYWRIGHT_SETUP_API_URL === 'https://testcloud.comfy.org' &&
        url.origin === 'https://testapi.comfy.org' &&
        request.method() === 'GET' &&
        /^\/customers(?:\/balance)?$/.test(url.pathname)
      ) {
        await route.fallback()
        return
      }
      if (url.origin === 'https://testapi.comfy.org') {
        networkPolicy.unexpected.add(`API ${url.origin}${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      if (
        !networkPolicy.origins.has(url.origin) &&
        url.hostname.endsWith('.comfy.org') &&
        /^\/(api|customers)(\/|$)/.test(url.pathname)
      ) {
        networkPolicy.unexpected.add(`API ${url.origin}${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      if (
        request.isNavigationRequest() &&
        !networkPolicy.origins.has(url.origin)
      ) {
        networkPolicy.unexpected.add(`Navigation ${url.origin}${url.pathname}`)
        await route.abort('blockedbyclient')
        return
      }
      if (
        url.origin === config.PLAYWRIGHT_TEST_URL &&
        /^\/(api|internal)(\/|$)/.test(url.pathname)
      ) {
        try {
          const response = await route.fetch({
            url: new URL(
              url.pathname + url.search,
              config.PLAYWRIGHT_SETUP_API_URL
            ).href,
            maxRedirects: 0
          })
          await route.fulfill({ response })
        } catch {
          throw new Error(`Cloud proxy request failed: ${url.pathname}`)
        }
        return
      }
      await route.fallback()
    })
    await use(context)
    await context.unrouteAll({ behavior: 'ignoreErrors' })
  },
  billingSession: async ({ page }, use) => {
    const config = loadLiveCloudBillingConfig()
    await new FeatureFlagHelper(page).seedFlags({
      onboarding_survey_enabled: false
    })
    await page.goto(`${config.PLAYWRIGHT_TEST_URL}/cloud/login`)
    await page
      .getByRole('button', { name: 'Use email instead', exact: true })
      .click()
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill(config.CLOUD_ACCOUNT_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill(config.CLOUD_ACCOUNT_PASSWORD)
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          matchesBillingResponse(
            response,
            config.PLAYWRIGHT_TEST_URL,
            '/api/billing/status'
          ) && response.status() === 200
      ),
      page.getByRole('button', { name: 'Sign in', exact: true }).click()
    ])
    const authorization = await response.request().headerValue('authorization')
    expect(authorization).toBeTruthy()
    if (!authorization) throw new Error('Missing billing authorization')
    await use(
      new LiveCloudBillingSession(
        page.request,
        config.PLAYWRIGHT_SETUP_API_URL,
        { authorization }
      )
    )
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
