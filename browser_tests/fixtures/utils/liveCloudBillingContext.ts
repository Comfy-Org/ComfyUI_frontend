import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import type { BrowserContext, Page, Route } from '@playwright/test'

import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import type { LiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import {
  getBlockedWriteViolation,
  getLiveCloudDestinationViolation,
  isLiveCloudMutationAllowed
} from '@e2e/fixtures/utils/liveCloudBillingPolicy'

function needsCloudRewrite(url: URL, config: LiveCloudBillingConfig): boolean {
  return (
    url.origin === config.PLAYWRIGHT_TEST_URL &&
    config.PLAYWRIGHT_TEST_URL !== config.PLAYWRIGHT_SETUP_API_URL &&
    /^\/(api|internal)(\/|$)/.test(url.pathname)
  )
}

async function resendToCloud(
  route: Route,
  targetUrl: URL,
  hasTestEnded: () => boolean
) {
  try {
    const response = await route.fetch({
      url: targetUrl.href,
      maxRedirects: 0
    })
    await route.fulfill({ response })
  } catch {
    if (hasTestEnded()) return
    throw new Error(`Cloud proxy request failed: ${targetUrl.pathname}`)
  }
}

export async function installLiveCloudBillingRouting(
  context: BrowserContext,
  networkPolicy: NetworkPolicy,
  config: LiveCloudBillingConfig
) {
  let testEnded = false
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const destinationViolation = getLiveCloudDestinationViolation(
      url,
      networkPolicy.origins,
      request.isNavigationRequest()
    )
    if (destinationViolation) {
      networkPolicy.unexpected.add(destinationViolation)
      await route.abort('blockedbyclient')
      return
    }
    const isCloudProxyRequest = needsCloudRewrite(url, config)
    const targetUrl = isCloudProxyRequest
      ? new URL(url.pathname + url.search, config.PLAYWRIGHT_SETUP_API_URL)
      : url
    if (
      networkPolicy.origins.has(url.origin) &&
      !isLiveCloudMutationAllowed(targetUrl, request.method(), config)
    ) {
      networkPolicy.unexpected.add(
        getBlockedWriteViolation(
          url,
          request.method(),
          config.PLAYWRIGHT_TEST_URL
        )
      )
      await route.abort('blockedbyclient')
      return
    }
    if (isCloudProxyRequest) {
      await resendToCloud(route, targetUrl, () => testEnded)
      return
    }
    await route.fallback()
  })
  return () => {
    testEnded = true
  }
}

export async function signInToLiveCloud(page: Page) {
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
        response.url() === `${config.PLAYWRIGHT_TEST_URL}/api/billing/status` &&
        response.status() === 200
    ),
    page.getByRole('button', { name: 'Sign in', exact: true }).click()
  ])
  zBillingStatusResponse.parse(await response.json())
}
