import type { APIRequestContext } from '@playwright/test'
import { expect, test as base } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'

import { HERO_SLIDES } from '@/platform/cloud/onboarding/constants/heroSlides'
import { assetPath } from '@e2e/fixtures/utils/paths'

dotenvConfig()

function guardApiRequests(
  request: APIRequestContext,
  origins: Set<string>,
  unexpected: Set<string>,
  baseURL?: string
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
    return fetch(urlOrRequest, { ...options, maxRedirects: 0 })
  }
  return () => {
    request.fetch = fetch
  }
}

export const networkIsolationFixture = base.extend<{
  networkPolicy: { origins: Set<string>; unexpected: Set<string> }
}>({
  serviceWorkers: 'block',
  networkPolicy: [
    async ({ baseURL }, use) => {
      const frontend =
        process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
      const origins = new Set(
        [
          frontend,
          baseURL,
          process.env.PLAYWRIGHT_SETUP_API_URL,
          process.env.DEV_SERVER_COMFYUI_URL
        ].flatMap((url) => (url ? [new URL(url).origin] : []))
      )
      const unexpected = new Set<string>()
      await use({ origins, unexpected })
      expect(
        [...unexpected],
        'Unexpected external requests. Add a local mock.'
      ).toEqual([])
    },
    { auto: true }
  ],
  request: async (
    { request, baseURL, networkPolicy: { origins, unexpected } },
    use
  ) => {
    const restore = guardApiRequests(request, origins, unexpected, baseURL)
    await use(request)
    restore()
  },
  context: async (
    { context, baseURL, networkPolicy: { origins, unexpected } },
    use
  ) => {
    const restore = guardApiRequests(
      context.request,
      origins,
      unexpected,
      baseURL
    )
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (origins.has(url.origin)) {
        await route.continue()
        return
      }
      unexpected.add(`${route.request().method()} ${url.origin}${url.pathname}`)
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

    await use(context)
    await context.close()
    restore()
  }
})
