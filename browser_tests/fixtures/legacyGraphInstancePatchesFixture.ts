import { readFile } from 'node:fs/promises'
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
          body: "export const app = window.comfyAPI?.app?.app ?? (await import('/src/scripts/appRegistry.ts')).useApp()",
          contentType: 'text/javascript'
        })
      )
      await page.route(
        '**/extensions/ComfyUI_devtools/legacyCompatibility.js*',
        async (route) =>
          route.fulfill({
            body: (
              await readFile(
                resolve(
                  import.meta.dirname,
                  '../../tools/devtools/web/legacyCompatibility.js'
                ),
                'utf8'
              )
            )
              .replace(
                'DevTools.LegacyGraphInstancePatches.Boot',
                'pysssss.WidgetDefaults'
              )
              .replace(
                'DevTools.LegacyGraphInstancePatches.Change',
                'cg.customnodes.use_everywhere'
              )
              .replace(
                'DevTools.LegacyGraphInstancePatches.Manager',
                'Comfy.ManagerMenu'
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
