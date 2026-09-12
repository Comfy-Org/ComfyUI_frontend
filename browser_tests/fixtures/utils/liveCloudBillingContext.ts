import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import {
  LiveCloudBillingSession,
  matchesBillingResponse
} from '@e2e/fixtures/helpers/LiveCloudBilling'
import type { NetworkPolicy } from '@e2e/fixtures/networkIsolationFixture'
import {
  loadLiveCloudBillingConfig,
  loadLiveCloudBillingEndpoints
} from '@e2e/fixtures/utils/liveCloudBillingConfig'

interface LiveCloudCredentials {
  email: string
  password: string
}

export async function installLiveCloudBillingRouting(
  context: BrowserContext,
  networkPolicy: NetworkPolicy
) {
  const config = loadLiveCloudBillingEndpoints()
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
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
}

export async function signInToLiveCloud(
  page: Page,
  credentials?: LiveCloudCredentials
) {
  const endpoints = loadLiveCloudBillingEndpoints()
  const account =
    credentials ??
    (() => {
      const config = loadLiveCloudBillingConfig()
      return {
        email: config.CLOUD_ACCOUNT_EMAIL,
        password: config.CLOUD_ACCOUNT_PASSWORD
      }
    })()
  await new FeatureFlagHelper(page).seedFlags({
    onboarding_survey_enabled: false
  })
  await page.goto(`${endpoints.PLAYWRIGHT_TEST_URL}/cloud/login`)
  await page
    .getByRole('button', { name: 'Use email instead', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  const [response] = await Promise.all([
    page.waitForResponse(
      (response) =>
        matchesBillingResponse(
          response,
          endpoints.PLAYWRIGHT_TEST_URL,
          '/api/billing/status'
        ) && response.status() === 200
    ),
    page.getByRole('button', { name: 'Sign in', exact: true }).click()
  ])
  await page.goto(endpoints.PLAYWRIGHT_TEST_URL)
  const authorization = await response.request().headerValue('authorization')
  expect(authorization).toBeTruthy()
  if (!authorization) throw new Error('Missing billing authorization')
  return new LiveCloudBillingSession(
    page.request,
    endpoints.PLAYWRIGHT_SETUP_API_URL,
    { authorization }
  )
}
