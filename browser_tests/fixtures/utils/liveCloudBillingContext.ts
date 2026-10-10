import { zBillingStatusResponse } from '@comfyorg/ingest-types/zod'
import type { BrowserContext, Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { OnboardingCoachmarks } from '@e2e/fixtures/components/Tour'
import { LiveCloudOnboarding } from '@e2e/fixtures/components/LiveCloudOnboarding'
import { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import type { LiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'
import { loadLiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import {
  LIVE_CHECKOUT_ORIGINS,
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
      (networkPolicy.origins.has(url.origin) ||
        LIVE_CHECKOUT_ORIGINS.includes(url.origin)) &&
      !isLiveCloudMutationAllowed(
        targetUrl,
        request.method(),
        config,
        url.pathname === '/api/settings' ? request.postDataJSON() : undefined
      )
    ) {
      networkPolicy.unexpected.add(
        `Mutation ${request.method()} ${url.origin}${url.pathname}`
      )
      await route.abort('blockedbyclient')
      return
    }
    if (isCloudProxyRequest) {
      await forwardCloudRequest(route, targetUrl)
      return
    }
    await route.fallback()
  })
}

async function forwardCloudRequest(route: Route, targetUrl: URL) {
  try {
    const response = await route.fetch({
      url: targetUrl.href,
      maxRedirects: 0
    })
    await route.fulfill({ response })
  } catch {
    if (route.request().frame().page().isClosed()) return
    throw new Error(`Cloud proxy request failed: ${targetUrl.pathname}`)
  }
}

export async function signInToLiveCloud(
  page: Page,
  config = loadLiveCloudBillingConfig()
) {
  if (!config.CLOUD_ACCOUNT_EMAIL || !config.CLOUD_ACCOUNT_PASSWORD)
    throw new Error('Live Cloud sign-in requires account credentials')
  await new OnboardingCoachmarks(page).dismissWhenVisible()
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
  const authorization = await response.request().headerValue('authorization')
  if (!authorization) throw new Error('Missing billing authorization')
  if (config.allowAccountCreation) {
    await new LiveCloudOnboarding(page).completeSurveyIfNeeded(
      config.PLAYWRIGHT_TEST_URL
    )
  } else {
    await expect(
      page.locator('#graph-canvas'),
      'Permanent accounts must complete onboarding when the survey flag is enabled'
    ).toBeVisible()
  }
  return new LiveCloudBillingSession(
    page.request,
    config.PLAYWRIGHT_SETUP_API_URL,
    { authorization }
  )
}
