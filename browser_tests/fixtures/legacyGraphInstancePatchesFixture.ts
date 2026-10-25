import { resolve } from 'node:path'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

export const test = comfyPageFixture.extend<{ legacyGraphPatches: void }>({
  initialLocalStorage: {
    'Comfy.DevTools.LegacyGraphInstancePatches': 'true',
    'Comfy.DevTools.ReplayGraphPatches': String(
      process.env.GRAPH_PATCH_REPLAY === '1'
    )
  },
  legacyGraphPatches: [
    async ({ page }, use) => {
      await page.route('**/scripts/app.js', (route) =>
        route.fulfill({
          body: "export const app = window.comfyAPI?.app?.app ?? (await import('/src/scripts/app.ts')).app",
          contentType: 'text/javascript'
        })
      )
      await page.route(
        '**/extensions/ComfyUI_devtools/legacyCompatibility.js*',
        (route) =>
          route.fulfill({
            path: resolve(
              import.meta.dirname,
              '../../tools/devtools/web/legacyCompatibility.js'
            ),
            contentType: 'text/javascript'
          })
      )
      await page.route('**/api/extensions', (route) =>
        route.fulfill({
          json: ['/extensions/ComfyUI_devtools/legacyCompatibility.js']
        })
      )
      await use()
    },
    { auto: true }
  ]
})
