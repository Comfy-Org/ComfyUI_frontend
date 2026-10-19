import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import type { BrowserContext, Page } from '@playwright/test'

import { FeatureFlagHelper } from '@e2e/fixtures/helpers/FeatureFlagHelper'
import type { LiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import {
  getLiveCloudDestinationViolation,
  isLiveCloudMutationAllowed
} from '@e2e/fixtures/utils/liveCloudBillingPolicy'

export async function installLiveCloudBillingRouting(
  context: BrowserContext,
  networkPolicy: NetworkPolicy,
  config: LiveCloudBillingConfig
) {
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
    const isCloudProxyRequest =
      url.origin === config.PLAYWRIGHT_TEST_URL &&
      /^\/(api|internal)(\/|$)/.test(url.pathname)
    const targetUrl = isCloudProxyRequest
      ? new URL(url.pathname + url.search, config.PLAYWRIGHT_SETUP_API_URL)
      : url
    if (
      networkPolicy.origins.has(url.origin) &&
      !isLiveCloudMutationAllowed(targetUrl, request.method(), config)
    ) {
      networkPolicy.unexpected.add(
        `Mutation ${request.method()} ${url.origin}${url.pathname}`
      )
      await route.abort('blockedbyclient')
      return
    }
    if (isCloudProxyRequest) {
      try {
        const response = await route.fetch({
          url: targetUrl.href,
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
