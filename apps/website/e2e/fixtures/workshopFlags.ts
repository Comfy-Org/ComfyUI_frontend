import type { BrowserContext } from '@playwright/test'

export async function stubWorkshopFlags(
  context: BrowserContext,
  featureFlags: Record<string, boolean>
) {
  await context.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' })
  )
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({ json: { featureFlags, featureFlagPayloads: {} } })
      : route.abort('blockedbyclient')
  )
}
