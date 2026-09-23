import type { LiveCloudBillingConfig } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import { installLiveCloudBillingRouting } from '@e2e/fixtures/utils/liveCloudBillingContext'
import {
  getBlockedRequestViolation,
  isLiveCloudMutationAllowed,
  isReportedViolation
} from '@e2e/fixtures/utils/liveCloudBillingPolicy'
import type { NetworkPolicy } from '@e2e/fixtures/utils/networkPolicy'
import { assetPath } from '@e2e/fixtures/utils/paths'
import type { APIRequestContext } from '@playwright/test'
import { expect, test as base } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

import { HERO_SLIDES } from '@/platform/cloud/onboarding/constants/heroSlides'

dotenvConfig()

function guardApiRequests(
  request: APIRequestContext,
  origins: Set<string>,
  unexpected: Set<string>,
  baseURL?: string,
  liveCloudBillingConfig?: LiveCloudBillingConfig
) {
  const fetch = request.fetch.bind(request)
  request.fetch = async (urlOrRequest, options) => {
    const url = new URL(
      typeof urlOrRequest === 'string' ? urlOrRequest : urlOrRequest.url(),
      baseURL
    )
    if (!origins.has(url.origin)) {
      const message = `API ${url.origin}${url.pathname}`
      unexpected.add(message)
      throw new Error(`Unexpected external request: ${message}`)
    }
    const method =
      options?.method ??
      (typeof urlOrRequest === 'string' ? 'GET' : urlOrRequest.method())
    if (
      liveCloudBillingConfig &&
      !isLiveCloudMutationAllowed(
        url,
        method.toUpperCase(),
        liveCloudBillingConfig
      )
    ) {
      const message = `Mutation ${method} ${url.origin}${url.pathname}`
      unexpected.add(message)
      throw new Error(`Forbidden live Cloud request: ${message}`)
    }
    return fetch(urlOrRequest, { ...options, maxRedirects: 0 })
  }
  return () => {
    request.fetch = fetch
  }
}

export const networkIsolationFixture = base.extend<{
  networkPolicy: NetworkPolicy
  liveCloudBillingConfig: LiveCloudBillingConfig | undefined
}>({
  serviceWorkers: 'block',
  liveCloudBillingConfig: [undefined, { option: true }],
  networkPolicy: [
    async ({ baseURL, liveCloudBillingConfig }, use, testInfo) => {
      const frontend =
        process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
      const origins = liveCloudBillingConfig
        ? new Set([
            liveCloudBillingConfig.PLAYWRIGHT_TEST_URL,
            liveCloudBillingConfig.PLAYWRIGHT_SETUP_API_URL,
            liveCloudBillingConfig.customerOrigin,
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://dreamboothy-dev.firebaseapp.com'
          ])
        : new Set(
            [
              frontend,
              baseURL,
              process.env.PLAYWRIGHT_SETUP_API_URL,
              process.env.DEV_SERVER_COMFYUI_URL
            ].flatMap((url) => (url ? [new URL(url).origin] : []))
          )
      const unexpected = new Set<string>()
      await use({ origins, unexpected })
      const blocked = [...unexpected]
      if (liveCloudBillingConfig) {
        await testInfo.attach('blocked-egress.json', {
          body: JSON.stringify(blocked),
          contentType: 'application/json'
        })
      }
      expect(
        liveCloudBillingConfig ? blocked.filter(isReportedViolation) : blocked,
        liveCloudBillingConfig
          ? 'Forbidden live Cloud requests'
          : 'Unexpected external requests. Add a local mock.'
      ).toEqual([])
    },
    { auto: true }
  ],
  request: async (
    {
      request,
      baseURL,
      networkPolicy: { origins, unexpected },
      liveCloudBillingConfig
    },
    use
  ) => {
    const restore = guardApiRequests(
      request,
      origins,
      unexpected,
      baseURL,
      liveCloudBillingConfig
    )
    await use(request)
    restore()
  },
  context: async (
    { context, baseURL, networkPolicy, liveCloudBillingConfig },
    use
  ) => {
    const { origins, unexpected } = networkPolicy
    const restore = guardApiRequests(
      context.request,
      origins,
      unexpected,
      baseURL,
      liveCloudBillingConfig
    )
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (origins.has(url.origin)) {
        await route.continue()
        return
      }
      unexpected.add(getBlockedRequestViolation(url, route.request().method()))
      await route.abort('blockedbyclient')
    })
    await context.routeWebSocket(
      (url) => !origins.has(url.origin.replace(/^ws/, 'http')),
      async (socket) => {
        const url = new URL(socket.url())
        unexpected.add(`WebSocket ${url.origin}${url.pathname}`)
        await socket.close()
      }
    )
    await context.route('https://huggingface.co/**/resolve/**', (route) =>
      route.request().method() === 'HEAD'
        ? route.fulfill({ status: 200, body: '' })
        : route.fallback()
    )
    await context.route(
      'https://utt.impactcdn.com/A6951770-3747-434a-9ac7-4e582e67d91f1.js',
      (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' })
    )
    await context.route('https://apis.google.com/js/api.js**', (route) =>
      route.fulfill({ status: 503, body: '' })
    )
    await context.route('https://cloud.comfy.org/cdn-cgi/trace', (route) =>
      route.fulfill({ contentType: 'text/plain', body: 'loc=US\n' })
    )
    for (const slide of HERO_SLIDES) {
      await context.route(slide.poster, (route) =>
        route.fulfill({ path: assetPath('image32x32.webp') })
      )
      await context.route(slide.src, (route) =>
        route.fulfill({ path: assetPath('video/video-preview-portrait.webm') })
      )
    }
    await context.route(
      'https://{api,stagingapi}.comfy.org/comfy-nodes/*/node',
      (route) => route.fulfill({ status: 404, body: '' })
    )
    await context.route(
      'https://{api,stagingapi}.comfy.org/nodes{,?*}',
      (route) => route.fulfill({ status: 404, body: '' })
    )

    if (liveCloudBillingConfig) {
      await installLiveCloudBillingRouting(
        context,
        networkPolicy,
        liveCloudBillingConfig
      )
    }
    await use(context)
    restore()
  }
})
