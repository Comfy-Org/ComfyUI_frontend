import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'

const simulacraFixture = comfyPageFixture.extend<{ ecosystemSimulacra: void }>({
  initialLocalStorage: {
    'Comfy.DevTools.EcosystemSimulacra': 'true'
  },
  ecosystemSimulacra: [
    async ({ page }, use) => {
      await page.route('**/scripts/app.js', (route) =>
        route.fulfill({
          body: "export const app = window.comfyAPI?.app?.app ?? (await import('/src/scripts/appRegistry.ts')).useApp()",
          contentType: 'text/javascript'
        })
      )
      await page.route(
        '**/extensions/ComfyUI_devtools/ecosystemSimulacra.js*',
        async (route) =>
          route.fulfill({
            body: await readFile(
              resolve(
                import.meta.dirname,
                '../../tools/devtools/web/ecosystemSimulacra.js'
              ),
              'utf8'
            ),
            contentType: 'text/javascript'
          })
      )
      await page.route('**/api/extensions', (route) =>
        route.fulfill({
          json: ['/extensions/ComfyUI_devtools/ecosystemSimulacra.js']
        })
      )
      await use()
    },
    { auto: true }
  ]
})

export const test = mergeTests(simulacraFixture, webSocketFixture)
