import { test as base } from './blockExternalMedia'

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route('**/t.comfy.org/**', (route) =>
      /\/(flags|decide)\//.test(route.request().url())
        ? route.fulfill({
            json: {
              featureFlags: {
                'workshop-enabled': true,
                'workshop-auth': false
              },
              featureFlagPayloads: {}
            }
          })
        : route.abort('blockedbyclient')
    )
    await use(context)
  }
})
